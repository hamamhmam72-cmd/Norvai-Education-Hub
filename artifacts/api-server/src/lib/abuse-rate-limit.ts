import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { abuseRateLimitsTable } from "@workspace/db/schema";

export class AbuseRateLimitUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The abuse rate-limit store is unavailable", { cause });
    this.name = "AbuseRateLimitUnavailableError";
  }
}

export type AbuseRateLimitRoute =
  | "/study/materials/process"
  | "/question-bank/quiz"
  | "/access/activate";

type ErrorLogger = {
  error: (bindings: Record<string, unknown>, message: string) => unknown;
};

/**
 * Emit a stable, safe event for log-based alerts when a protected route cannot
 * reach the shared limiter. Do not accept the counter key or underlying error:
 * either could expose counter contents or database connection details.
 */
export function recordAbuseRateLimitStoreUnavailable(
  log: ErrorLogger | undefined,
  route: AbuseRateLimitRoute,
  userId: number,
) {
  log?.error(
    {
      event: "rate_limit_store_unavailable",
      store: "abuse_rate_limits",
      route,
      userScope: {
        kind: "user",
        id: userId,
      },
    },
    "Protected route rate-limit store unavailable",
  );
}

export const ABUSE_RATE_LIMIT_CLEANUP_BATCH_SIZE = 100;

async function cleanupExpiredCounters(database: typeof db, now: Date) {
  // Keep cleanup bounded so one protected request cannot scan/delete an
  // unbounded backlog. The expiry index makes the candidate selection cheap.
  await database.execute(sql`
    WITH expired AS (
      SELECT ${sql.raw('"key"')}
      FROM ${abuseRateLimitsTable}
      WHERE ${abuseRateLimitsTable.expiresAt} <= ${now}
      ORDER BY ${abuseRateLimitsTable.expiresAt}
      LIMIT ${ABUSE_RATE_LIMIT_CLEANUP_BATCH_SIZE}
    )
    DELETE FROM ${abuseRateLimitsTable}
    WHERE ${abuseRateLimitsTable.key} IN (SELECT ${sql.raw('"key"')} FROM expired)
  `);
}

export function createAbuseRateLimiter(database: typeof db = db) {
  async function allow(
    key: string,
    limit: number,
    windowMs: number,
    now = new Date(),
  ): Promise<boolean> {
    if (!key || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1) {
      throw new Error("Invalid abuse rate-limit configuration");
    }
    const expiresAt = new Date(now.getTime() + windowMs);

    try {
      await cleanupExpiredCounters(database, now);

      const [counter] = await database.insert(abuseRateLimitsTable).values({
        key,
        count: 1,
        expiresAt,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: abuseRateLimitsTable.key,
        set: {
          count: sql`CASE
            WHEN ${abuseRateLimitsTable.expiresAt} <= ${now} THEN 1
            WHEN ${abuseRateLimitsTable.count} < ${limit}
              THEN ${abuseRateLimitsTable.count} + 1
            ELSE ${limit + 1}
          END`,
          expiresAt: sql`CASE
            WHEN ${abuseRateLimitsTable.expiresAt} <= ${now} THEN ${expiresAt}
            ELSE ${abuseRateLimitsTable.expiresAt}
          END`,
          updatedAt: now,
        },
      }).returning({ count: abuseRateLimitsTable.count });

      return counter.count <= limit;
    } catch (error) {
      throw new AbuseRateLimitUnavailableError(error);
    }
  }

  async function clear(key: string): Promise<void> {
    try {
      await database.delete(abuseRateLimitsTable).where(sql`${abuseRateLimitsTable.key} = ${key}`);
    } catch {
      // The next expiry cleanup removes the row; never expose counter contents.
    }
  }

  return {
    allowAbuseRequest: allow,
    clearAbuseCounter: clear,
  };
}

/**
 * Atomically consumes one request from a shared counter.
 *
 * The bounded cleanup and conflict update together prevent expired-row
 * backlogs from slowing requests while ensuring separate API instances
 * cannot reset or bypass the same user's counter.
 */
export async function allowAbuseRequest(
  key: string,
  limit: number,
  windowMs: number,
  now = new Date(),
): Promise<boolean> {
  return defaultAbuseRateLimiter.allowAbuseRequest(key, limit, windowMs, now);
}

/**
 * Clearing is best-effort because the row naturally expires. It is kept
 * separate from consuming so a cleanup failure never turns a successful
 * activation into a second, inconsistent operation.
 */
export async function clearAbuseCounter(key: string): Promise<void> {
  return defaultAbuseRateLimiter.clearAbuseCounter(key);
}

const defaultAbuseRateLimiter = createAbuseRateLimiter();

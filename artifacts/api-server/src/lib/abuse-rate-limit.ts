import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { abuseRateLimitsTable } from "@workspace/db/schema";

export class AbuseRateLimitUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The abuse rate-limit store is unavailable", { cause });
    this.name = "AbuseRateLimitUnavailableError";
  }
}

export const ABUSE_RATE_LIMIT_CLEANUP_BATCH_SIZE = 100;

async function cleanupExpiredCounters(now: Date) {
  // Keep cleanup bounded so one protected request cannot scan/delete an
  // unbounded backlog. The expiry index makes the candidate selection cheap.
  await db.execute(sql`
    WITH expired AS (
      SELECT ${abuseRateLimitsTable.key}
      FROM ${abuseRateLimitsTable}
      WHERE ${abuseRateLimitsTable.expiresAt} <= ${now}
      ORDER BY ${abuseRateLimitsTable.expiresAt}
      LIMIT ${ABUSE_RATE_LIMIT_CLEANUP_BATCH_SIZE}
    )
    DELETE FROM ${abuseRateLimitsTable}
    WHERE ${abuseRateLimitsTable.key} IN (SELECT ${abuseRateLimitsTable.key} FROM expired)
  `);
}

/**
 * Atomically consumes one request from a shared counter.
 *
 * A bounded batch of expired rows is removed opportunistically. The conflict
 * update still handles a concurrent request whose previous window expired, so
 * separate API instances cannot reset or bypass the same user's counter.
 */
export async function allowAbuseRequest(
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
    await cleanupExpiredCounters(now);

    const [counter] = await db.insert(abuseRateLimitsTable).values({
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

/**
 * Clearing is best-effort because the row naturally expires. It is kept
 * separate from consuming so a cleanup failure never turns a successful
 * activation into a second, inconsistent operation.
 */
export async function clearAbuseCounter(key: string): Promise<void> {
  try {
    await db.delete(abuseRateLimitsTable).where(sql`${abuseRateLimitsTable.key} = ${key}`);
  } catch {
    // The next expiry cleanup removes the row; never expose counter contents.
  }
}
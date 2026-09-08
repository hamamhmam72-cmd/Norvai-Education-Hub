import { lte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { teamMessageRateLimitsTable } from "@workspace/db/schema";

export const TEAM_MESSAGE_LIMIT = 30;
export const TEAM_MESSAGE_WINDOW_MS = 60_000;

export class TeamMessageRateLimitUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The team message rate-limit store is unavailable", { cause });
    this.name = "TeamMessageRateLimitUnavailableError";
  }
}

/**
 * Consume one message from the shared per-user window.
 *
 * The primary key and ON CONFLICT update make the counter atomic across API
 * processes. An unavailable store is deliberately surfaced to the caller so
 * the route can fail closed instead of bypassing abuse protection.
 */
export async function allowTeamMessage(userId: number, now = new Date()): Promise<boolean> {
  const expiresAt = new Date(now.getTime() + TEAM_MESSAGE_WINDOW_MS);

  try {
    await db.delete(teamMessageRateLimitsTable)
      .where(lte(teamMessageRateLimitsTable.expiresAt, now));

    const [counter] = await db.insert(teamMessageRateLimitsTable).values({
      userId,
      count: 1,
      expiresAt,
    }).onConflictDoUpdate({
      target: teamMessageRateLimitsTable.userId,
      set: {
        count: sql`CASE
          WHEN ${teamMessageRateLimitsTable.expiresAt} <= ${now} THEN 1
          WHEN ${teamMessageRateLimitsTable.count} < ${TEAM_MESSAGE_LIMIT}
            THEN ${teamMessageRateLimitsTable.count} + 1
          ELSE ${TEAM_MESSAGE_LIMIT + 1}
        END`,
        expiresAt: sql`CASE
          WHEN ${teamMessageRateLimitsTable.expiresAt} <= ${now} THEN ${expiresAt}
          ELSE ${teamMessageRateLimitsTable.expiresAt}
        END`,
      },
    }).returning({
      count: teamMessageRateLimitsTable.count,
    });

    return counter.count <= TEAM_MESSAGE_LIMIT;
  } catch (error) {
    throw new TeamMessageRateLimitUnavailableError(error);
  }
}
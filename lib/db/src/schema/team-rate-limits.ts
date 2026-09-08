import { index, integer, pgTable, timestamp } from "drizzle-orm/pg-core";

export const teamMessageRateLimitsTable = pgTable("team_message_rate_limits", {
  userId: integer("user_id").primaryKey(),
  count: integer("count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => ({
  expiresAtIndex: index("team_message_rate_limits_expires_at_idx").on(table.expiresAt),
}));
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Shared counters for abuse controls that must work across API instances.
 * The key includes the scope (for example, user id and limit name).
 */
export const abuseRateLimitsTable = pgTable("abuse_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  expiresAtIndex: index("abuse_rate_limits_expires_at_idx").on(table.expiresAt),
}));
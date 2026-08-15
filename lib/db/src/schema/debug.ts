import {
  pgTable,
  serial,
  text,
  integer,
  json,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const debugSessionsTable = pgTable("debug_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  language: text("language").notNull(),
  code: text("code").notNull(),
  status: text("status").notNull().default("clean"), // "clean" | "has_errors"
  efficiencyScore: integer("efficiency_score"),
  errors: json("errors").notNull().default([]),
  explanation: text("explanation"),
  bestPractices: text("best_practices").array().notNull().default([]),
  fixedCode: text("fixed_code"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertDebugSessionSchema = createInsertSchema(
  debugSessionsTable
).omit({ id: true, createdAt: true });
export type InsertDebugSession = z.infer<typeof insertDebugSessionSchema>;
export type DebugSession = typeof debugSessionsTable.$inferSelect;

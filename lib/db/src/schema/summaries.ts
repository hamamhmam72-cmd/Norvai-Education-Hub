import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const summariesTable = pgTable("summaries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title"),
  topic: text("topic").notNull(),
  originalText: text("original_text").notNull(),
  summary: text("summary").notNull(),
  keyPoints: text("key_points").array().notNull().default([]),
  technicalTerms: text("technical_terms").array().notNull().default([]),
  difficultyLevel: text("difficulty_level"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSummarySchema = createInsertSchema(summariesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSummary = z.infer<typeof insertSummarySchema>;
export type Summary = typeof summariesTable.$inferSelect;

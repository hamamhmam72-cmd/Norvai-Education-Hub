import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studySessionsTable = pgTable("study_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  minutes: integer("minutes").notNull(),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questionBankItemsTable = pgTable("question_bank_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  university: text("university").notNull(),
  major: text("major").notNull(),
  course: text("course").notNull(),
  prompt: text("prompt").notNull(),
  answer: text("answer"),
  sourceLabel: text("source_label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamSnippetsTable = pgTable("team_snippets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  language: text("language").notNull(),
  code: text("code").notNull(),
  review: text("review").notNull(),
  visibility: text("visibility").notNull().default("team"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStudySessionSchema = createInsertSchema(studySessionsTable).omit({ id: true, createdAt: true });
export const insertQuestionBankItemSchema = createInsertSchema(questionBankItemsTable).omit({ id: true, createdAt: true });
export const insertTeamSnippetSchema = createInsertSchema(teamSnippetsTable).omit({ id: true, createdAt: true });

export type StudySession = z.infer<typeof insertStudySessionSchema>;
export type QuestionBankItem = z.infer<typeof insertQuestionBankItemSchema>;
export type TeamSnippet = z.infer<typeof insertTeamSnippetSchema>;
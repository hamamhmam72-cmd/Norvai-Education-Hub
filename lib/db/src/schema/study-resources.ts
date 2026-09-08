import { pgTable, serial, integer, text, timestamp, json } from "drizzle-orm/pg-core";
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
  university: text("university").notNull(),
  major: text("major").notNull(),
  title: text("title").notNull(),
  language: text("language").notNull(),
  code: text("code").notNull(),
  review: text("review").notNull(),
  visibility: text("visibility").notNull().default("team"),
  projectId: integer("project_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const teamMessagesTable = pgTable("team_messages", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const interviewSessionsTable = pgTable("interview_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull(),
  mode: text("mode").notNull().default("text"),
  language: text("language").notNull().default("English"),
  status: text("status").notNull().default("active"),
  messages: json("messages").notNull().default([]),
  score: integer("score"),
  feedback: text("feedback"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudySessionSchema = createInsertSchema(studySessionsTable).omit({ id: true, createdAt: true });
export const insertQuestionBankItemSchema = createInsertSchema(questionBankItemsTable).omit({ id: true, createdAt: true });
export const insertTeamSnippetSchema = createInsertSchema(teamSnippetsTable).omit({ id: true, createdAt: true });
export const insertTeamMessageSchema = createInsertSchema(teamMessagesTable).omit({ id: true, createdAt: true });
export const insertInterviewSessionSchema = createInsertSchema(interviewSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type StudySession = z.infer<typeof insertStudySessionSchema>;
export type QuestionBankItem = z.infer<typeof insertQuestionBankItemSchema>;
export type TeamSnippet = z.infer<typeof insertTeamSnippetSchema>;
export type InterviewSession = z.infer<typeof insertInterviewSessionSchema>;
import {
  integer,
  json,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const memorizationDecksTable = pgTable("memorization_decks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  summaryId: integer("summary_id"),
  title: text("title").notNull(),
  sourceLabel: text("source_label"),
  bulletSummary: json("bullet_summary").notNull().default([]),
  flashcards: json("flashcards").notNull().default([]),
  fillBlanks: json("fill_blanks").notNull().default([]),
  quickQuiz: json("quick_quiz").notNull().default([]),
  examQuestions: json("exam_questions").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const flashcardProgressTable = pgTable("flashcard_progress", {
  id: serial("id").primaryKey(),
  deckId: integer("deck_id").notNull().references(() => memorizationDecksTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  cardId: text("card_id").notNull(),
  reviewCount: integer("review_count").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  intervalDays: integer("interval_days").notNull().default(0),
  easeFactor: real("ease_factor").notNull().default(2.5),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  deckUserCardUnique: uniqueIndex("flashcard_progress_deck_user_card_unique")
    .on(table.deckId, table.userId, table.cardId),
}));

export const insertMemorizationDeckSchema = createInsertSchema(memorizationDecksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertFlashcardProgressSchema = createInsertSchema(flashcardProgressTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMemorizationDeck = z.infer<typeof insertMemorizationDeckSchema>;
export type MemorizationDeck = typeof memorizationDecksTable.$inferSelect;
export type InsertFlashcardProgress = z.infer<typeof insertFlashcardProgressSchema>;
export type FlashcardProgress = typeof flashcardProgressTable.$inferSelect;
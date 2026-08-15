import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { curriculaTable } from "./curricula";

export const lecturesTable = pgTable("lectures", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  youtubeId: text("youtube_id").notNull(),
  youtubeUrl: text("youtube_url").notNull(),
  instructor: text("instructor"),
  description: text("description"),
  specialization: text("specialization").notNull(),
  difficulty: text("difficulty").notNull().default("beginner"),
  durationMinutes: integer("duration_minutes"),
  curriculumId: integer("curriculum_id").references(() => curriculaTable.id, {
    onDelete: "set null",
  }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const savedLecturesTable = pgTable("saved_lectures", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lectureId: integer("lecture_id")
    .notNull()
    .references(() => lecturesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const completedLecturesTable = pgTable("completed_lectures", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lectureId: integer("lecture_id")
    .notNull()
    .references(() => lecturesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertLectureSchema = createInsertSchema(lecturesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLecture = z.infer<typeof insertLectureSchema>;
export type Lecture = typeof lecturesTable.$inferSelect;

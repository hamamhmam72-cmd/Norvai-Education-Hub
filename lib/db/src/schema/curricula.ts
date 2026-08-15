import {
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const curriculaTable = pgTable("curricula", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  specialization: text("specialization").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCurriculumSchema = createInsertSchema(curriculaTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCurriculum = z.infer<typeof insertCurriculumSchema>;
export type Curriculum = typeof curriculaTable.$inferSelect;

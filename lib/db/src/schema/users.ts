import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("student"), // "student" | "admin"
  setupComplete: boolean("setup_complete").notNull().default(false),
  university: text("university"),
  major: text("major"),
  yearOfStudy: integer("year_of_study"),
  specialization: text("specialization"),
  skillLevel: text("skill_level"), // "beginner" | "intermediate" | "advanced"
  knownLanguages: text("known_languages").array().notNull().default([]),
  avatarUrl: text("avatar_url"),
  accessActivated: boolean("access_activated").notNull().default(false),
  subscriptionActive: boolean("subscription_active").notNull().default(false),
  subscriptionExpiry: timestamp("subscription_expiry", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

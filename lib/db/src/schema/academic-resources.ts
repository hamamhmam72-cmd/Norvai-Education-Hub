import {
  boolean,
  integer,
  json,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const academicResourcesTable = pgTable("academic_resources", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by").notNull(),
  type: text("type").notNull(), // lecture | research | non_it
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  description: text("description"),
  professorName: text("professor_name"),
  professorUniversity: text("professor_university"),
  language: text("language").notNull().default("Arabic"),
  sourceUrl: text("source_url"),
  objectPath: text("object_path"),
  mimeType: text("mime_type"),
  summary: text("summary"),
  questions: json("questions").notNull().default([]),
  mindMap: json("mind_map").notNull().default([]),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nonItSubjectsTable = pgTable("non_it_subjects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priceFils: integer("price_fils").notNull().default(10_000),
  durationMonths: integer("duration_months").notNull().default(3),
  isActive: boolean("is_active").notNull().default(true),
});

export const teamProjectsTable = pgTable("team_projects", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  university: text("university").notNull(),
  major: text("major").notNull(),
  name: text("name").notNull(),
  completionPercent: integer("completion_percent").notNull().default(0),
  sharedCode: text("shared_code").notNull().default(""),
  codeLanguage: text("code_language").notNull().default("TypeScript"),
  codeVersion: integer("code_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const teamProjectMembersTable = pgTable("team_project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => teamProjectsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"), // owner | editor | viewer
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  memberUnique: uniqueIndex("team_project_members_unique").on(table.projectId, table.userId),
}));

export const linkedinProfilesTable = pgTable("linkedin_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  profileUrl: text("profile_url").notNull(),
  headline: text("headline"),
  skills: text("skills").array().notNull().default([]),
  summary: text("summary"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  userUnique: uniqueIndex("linkedin_profiles_user_unique").on(table.userId),
}));

export const insertAcademicResourceSchema = createInsertSchema(academicResourcesTable).omit({ id: true, createdAt: true });
export const insertNonItSubjectSchema = createInsertSchema(nonItSubjectsTable).omit({ id: true });
export const insertTeamProjectSchema = createInsertSchema(teamProjectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTeamProjectMemberSchema = createInsertSchema(teamProjectMembersTable).omit({ id: true, createdAt: true });
export const insertLinkedinProfileSchema = createInsertSchema(linkedinProfilesTable).omit({ id: true, updatedAt: true });

export type AcademicResource = z.infer<typeof insertAcademicResourceSchema>;
export type NonItSubject = z.infer<typeof insertNonItSubjectSchema>;
export type TeamProject = z.infer<typeof insertTeamProjectSchema>;
export type TeamProjectMember = z.infer<typeof insertTeamProjectMemberSchema>;
export type LinkedinProfile = z.infer<typeof insertLinkedinProfileSchema>;
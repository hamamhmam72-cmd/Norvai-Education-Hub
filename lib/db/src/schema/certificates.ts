import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  level: text("level").notNull(), // "beginner" | "intermediate" | "advanced"
  certificateNumber: text("certificate_number").notNull().unique(),
  studentName: text("student_name").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (t) => [unique("certificates_user_level_unique").on(t.userId, t.level)]);

export const insertCertificateSchema = createInsertSchema(
  certificatesTable
).omit({ id: true, issuedAt: true });
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificatesTable.$inferSelect;

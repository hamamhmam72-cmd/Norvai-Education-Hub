import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionRequestsTable = pgTable("subscription_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  plan: text("plan").notNull(), // "3months" | "6months" | "1year"
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected"
  receiptUrl: text("receipt_url").notNull(),
  provider: text("provider").notNull().default("cliq"),
  transferReference: text("transfer_reference"),
  senderName: text("sender_name"),
  amountFils: integer("amount_fils"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSubscriptionRequestSchema = createInsertSchema(
  subscriptionRequestsTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionRequest = z.infer<
  typeof insertSubscriptionRequestSchema
>;
export type SubscriptionRequest = typeof subscriptionRequestsTable.$inferSelect;

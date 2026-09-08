import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { db } from "@workspace/db";
import { subscriptionRequestsTable, usersTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

const PLAN_DURATION_MONTHS: Record<string, number> = {
  "3months": 3,
  "6months": 6,
  "1year": 12,
};
const PLAN_AMOUNT_FILS: Record<string, number> = {
  "3months": 10_000,
  "6months": 19_000,
  "1year": 36_000,
};
const planAmount = (plan: string, accountType: string) =>
  (PLAN_AMOUNT_FILS[plan] ?? 0) * (accountType === "team" ? 2 : 1);

// GET /api/subscriptions/status
router.get("/subscriptions/status", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, uid))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Get latest pending request
  const requests = await db
    .select()
    .from(subscriptionRequestsTable)
    .where(eq(subscriptionRequestsTable.userId, uid));

  const pending = requests.find((r) => r.status === "pending");
  const approved = requests
    .filter((r) => r.status === "approved")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

  res.json({
    active: user.subscriptionActive,
    plan: approved?.plan ?? null,
    accountType: approved?.accountType ?? user.subscriptionTier,
    expiryDate: user.subscriptionExpiry?.toISOString() ?? null,
    pendingRequest: Boolean(pending),
    pendingRequestDate: pending?.createdAt.toISOString() ?? null,
    subscriptionActive: user.subscriptionActive,
    subscriptionExpiry: user.subscriptionExpiry?.toISOString() ?? null,
  });
});

// POST /api/subscriptions/request
router.post("/subscriptions/request", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const plan = typeof req.body.plan === "string" ? req.body.plan : "";
  const accountType = req.body.accountType === "team" ? "team" : req.body.accountType === "individual" ? "individual" : "";
  const receiptUrl = typeof req.body.receiptUrl === "string" ? req.body.receiptUrl.trim() : "";
  const transferReference = typeof req.body.transferReference === "string"
    ? req.body.transferReference.trim().toUpperCase().slice(0, 80)
    : "";
  const senderName = typeof req.body.senderName === "string"
    ? req.body.senderName.trim().slice(0, 120)
    : "";
  if (!plan || !accountType || !receiptUrl || !transferReference || !senderName) {
    res.status(400).json({ error: "plan, account type, receipt, sender name, and CliQ reference are required" });
    return;
  }
  const validPlans = ["3months", "6months", "1year"];
  if (!validPlans.includes(plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }
  if (!/^[A-Z0-9._-]{4,80}$/.test(transferReference)) {
    res.status(400).json({ error: "Invalid CliQ transfer reference" });
    return;
  }
  if (!receiptUrl.startsWith("data:image/") && !/^https:\/\/[^\\s]+$/i.test(receiptUrl)) {
    res.status(400).json({ error: "Receipt must be an uploaded image or a secure HTTPS URL" });
    return;
  }
  const [duplicate] = await db.select({ id: subscriptionRequestsTable.id })
    .from(subscriptionRequestsTable)
    .where(and(
      eq(subscriptionRequestsTable.provider, "cliq"),
      eq(subscriptionRequestsTable.transferReference, transferReference),
    )).limit(1);
  if (duplicate) {
    res.status(409).json({ error: "This CliQ reference has already been submitted" });
    return;
  }

  const [request] = await db
    .insert(subscriptionRequestsTable)
    .values({
      userId: uid,
      plan,
      accountType,
      receiptUrl,
      provider: "cliq",
      transferReference,
      senderName,
      amountFils: planAmount(plan, accountType),
      status: "pending",
    })
    .returning();

  res.status(201).json({
    id: request.id,
    plan: request.plan,
    accountType: request.accountType,
    status: request.status,
    receiptUrl: request.receiptUrl,
    provider: request.provider,
    transferReference: request.transferReference,
    senderName: request.senderName,
    amountFils: request.amountFils,
    createdAt: request.createdAt.toISOString(),
  });
});

/**
 * Adapter for an official bank/CliQ settlement webhook.
 * It intentionally does nothing until a provider secret is configured.
 * A receipt image alone never reaches this path and cannot activate access.
 */
router.post("/subscriptions/cliq/webhook", async (req, res) => {
  const configuredSecret = process.env.CLIQ_WEBHOOK_SECRET;
  const providedSecret = typeof req.headers["x-cliq-webhook-secret"] === "string"
    ? req.headers["x-cliq-webhook-secret"]
    : "";
  if (!configuredSecret) {
    res.status(503).json({ error: "CliQ settlement webhook is not configured" });
    return;
  }
  const expected = Buffer.from(configuredSecret);
  const received = Buffer.from(providedSecret);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }
  const reference = typeof req.body?.reference === "string" ? req.body.reference.trim().toUpperCase().slice(0, 80) : "";
  const status = typeof req.body?.status === "string" ? req.body.status.toLowerCase() : "";
  const amountFils = Number(req.body?.amountFils);
  if (!reference || status !== "settled" || !Number.isInteger(amountFils) || amountFils < 1) {
    res.status(400).json({ error: "reference, settled status, and amountFils are required" });
    return;
  }
  const [request] = await db.select().from(subscriptionRequestsTable)
    .where(and(
      eq(subscriptionRequestsTable.provider, "cliq"),
      eq(subscriptionRequestsTable.transferReference, reference),
      eq(subscriptionRequestsTable.status, "pending"),
    )).limit(1);
  if (!request) {
    res.status(404).json({ error: "Pending CliQ request not found" });
    return;
  }
  if (request.amountFils !== amountFils) {
    res.status(409).json({ error: "Settlement amount does not match the selected plan" });
    return;
  }
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + (PLAN_DURATION_MONTHS[request.plan] ?? 3));
  await db.update(subscriptionRequestsTable).set({ status: "approved" }).where(eq(subscriptionRequestsTable.id, request.id));
  await db.update(usersTable).set({ subscriptionActive: true, subscriptionTier: request.accountType, subscriptionExpiry: expiry }).where(eq(usersTable.id, request.userId));
  res.json({ id: request.id, status: "approved" });
});

// GET /api/subscriptions (admin)
router.get("/subscriptions", requireAdmin, async (req, res) => {
  const { status } = req.query as { status?: string };
  const requests = await db.select().from(subscriptionRequestsTable);
  const filtered = status
    ? requests.filter((r) => r.status === status)
    : requests;
  res.json(
    filtered.map((r) => ({
      id: r.id,
      userId: r.userId,
      plan: r.plan,
      accountType: r.accountType,
      status: r.status,
      receiptUrl: r.receiptUrl,
      provider: r.provider,
      transferReference: r.transferReference,
      senderName: r.senderName,
      amountFils: r.amountFils,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
  );
});

// POST /api/subscriptions/:id/approve (admin)
router.post(
  "/subscriptions/:id/approve",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    const [request] = await db
      .select()
      .from(subscriptionRequestsTable)
      .where(eq(subscriptionRequestsTable.id, id))
      .limit(1);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    const months = PLAN_DURATION_MONTHS[request.plan] ?? 3;
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);

    await db
      .update(subscriptionRequestsTable)
      .set({ status: "approved" })
      .where(eq(subscriptionRequestsTable.id, id));

    await db
      .update(usersTable)
      .set({ subscriptionActive: true, subscriptionTier: request.accountType, subscriptionExpiry: expiry })
      .where(eq(usersTable.id, request.userId));

    res.json({ id, status: "approved" });
  }
);

// POST /api/subscriptions/:id/reject (admin)
router.post(
  "/subscriptions/:id/reject",
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id);
    const { reason } = req.body;
    const [request] = await db
      .select()
      .from(subscriptionRequestsTable)
      .where(eq(subscriptionRequestsTable.id, id))
      .limit(1);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    await db
      .update(subscriptionRequestsTable)
      .set({ status: "rejected", rejectionReason: reason ?? null })
      .where(eq(subscriptionRequestsTable.id, id));

    res.json({ id, status: "rejected" });
  }
);

export default router;

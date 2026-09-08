import { Router } from "express";
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
  "1year": 55_000,
};

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
  const receiptUrl = typeof req.body.receiptUrl === "string" ? req.body.receiptUrl.trim() : "";
  const transferReference = typeof req.body.transferReference === "string"
    ? req.body.transferReference.trim().toUpperCase().slice(0, 80)
    : "";
  const senderName = typeof req.body.senderName === "string"
    ? req.body.senderName.trim().slice(0, 120)
    : "";
  if (!plan || !receiptUrl || !transferReference || !senderName) {
    res.status(400).json({ error: "plan, receipt, sender name, and CliQ reference are required" });
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
      receiptUrl,
      provider: "cliq",
      transferReference,
      senderName,
      amountFils: PLAN_AMOUNT_FILS[plan],
      status: "pending",
    })
    .returning();

  res.status(201).json({
    id: request.id,
    plan: request.plan,
    status: request.status,
    receiptUrl: request.receiptUrl,
    provider: request.provider,
    transferReference: request.transferReference,
    senderName: request.senderName,
    amountFils: request.amountFils,
    createdAt: request.createdAt.toISOString(),
  });
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
      .set({ subscriptionActive: true, subscriptionExpiry: expiry })
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

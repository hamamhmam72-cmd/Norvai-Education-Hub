import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionRequestsTable, usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

const PLAN_DURATION_MONTHS: Record<string, number> = {
  "3months": 3,
  "6months": 6,
  "1year": 12,
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

  res.json({
    subscriptionActive: user.subscriptionActive,
    subscriptionExpiry: user.subscriptionExpiry?.toISOString() ?? null,
    pendingRequest: pending
      ? {
          id: pending.id,
          plan: pending.plan,
          status: pending.status,
          createdAt: pending.createdAt.toISOString(),
        }
      : null,
  });
});

// POST /api/subscriptions/request
router.post("/subscriptions/request", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const { plan, receiptUrl } = req.body;
  if (!plan || !receiptUrl) {
    res.status(400).json({ error: "plan and receiptUrl are required" });
    return;
  }
  const validPlans = ["3months", "6months", "1year"];
  if (!validPlans.includes(plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  const [request] = await db
    .insert(subscriptionRequestsTable)
    .values({ userId: uid, plan, receiptUrl, status: "pending" })
    .returning();

  res.status(201).json({
    id: request.id,
    plan: request.plan,
    status: request.status,
    receiptUrl: request.receiptUrl,
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

import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  lecturesTable,
  quizAttemptsTable,
  debugSessionsTable,
  summariesTable,
  subscriptionRequestsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/admin/users
router.get("/admin/users", requireAdmin, async (_req, res) => {
  const users = await db.select().from(usersTable);
  res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      setupComplete: u.setupComplete,
      specialization: u.specialization,
      skillLevel: u.skillLevel,
      subscriptionActive: u.subscriptionActive,
      createdAt: u.createdAt.toISOString(),
    }))
  );
});

// GET /api/admin/stats
router.get("/admin/stats", requireAdmin, async (_req, res) => {
  const [users, lectures, attempts, debugs, summaries, subRequests] =
    await Promise.all([
      db.select().from(usersTable),
      db.select().from(lecturesTable),
      db.select().from(quizAttemptsTable),
      db.select().from(debugSessionsTable),
      db.select().from(summariesTable),
      db.select().from(subscriptionRequestsTable),
    ]);

  res.json({
    totalUsers: users.length,
    totalStudents: users.filter((u) => u.role === "student").length,
    totalLectures: lectures.length,
    totalQuizAttempts: attempts.length,
    totalDebugSessions: debugs.length,
    totalSummaries: summaries.length,
    pendingSubscriptions: subRequests.filter((r) => r.status === "pending").length,
    activeSubscriptions: users.filter((u) => u.subscriptionActive).length,
  });
});

export default router;

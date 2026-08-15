import { Router } from "express";
import { db } from "@workspace/db";
import { feedbackTable, usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

const VALID_CATEGORIES = ["suggestion", "bug", "experience", "other"];

// POST /api/feedback
router.post("/feedback", requireAuth, async (req, res) => {
  const { category, message, rating } = req.body;
  if (!message || typeof message !== "string" || message.trim().length < 3) {
    res.status(400).json({ error: "message is required (min 3 characters)" });
    return;
  }
  if (message.length > 5000) {
    res.status(400).json({ error: "message too long (max 5000 characters)" });
    return;
  }
  if (category != null && !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: "Invalid category" });
    return;
  }
  const cat = category ?? "suggestion";
  if (
    rating != null &&
    (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5)
  ) {
    res.status(400).json({ error: "rating must be an integer between 1 and 5" });
    return;
  }
  const parsedRating = rating != null ? Number(rating) : null;

  const [fb] = await db
    .insert(feedbackTable)
    .values({
      userId: req.user!.userId,
      category: cat,
      message: message.trim(),
      rating: parsedRating,
    })
    .returning();

  res.status(201).json({
    id: fb.id,
    category: fb.category,
    message: fb.message,
    rating: fb.rating,
    createdAt: fb.createdAt.toISOString(),
  });
});

// GET /api/feedback (admin) — all feedback with usernames
router.get("/feedback", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: feedbackTable.id,
      category: feedbackTable.category,
      message: feedbackTable.message,
      rating: feedbackTable.rating,
      createdAt: feedbackTable.createdAt,
      username: usersTable.username,
      fullName: usersTable.fullName,
    })
    .from(feedbackTable)
    .innerJoin(usersTable, eq(feedbackTable.userId, usersTable.id))
    .orderBy(desc(feedbackTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      category: r.category,
      message: r.message,
      rating: r.rating,
      createdAt: r.createdAt.toISOString(),
      username: r.username,
      fullName: r.fullName,
    }))
  );
});

export default router;

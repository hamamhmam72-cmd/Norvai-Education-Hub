import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import crypto from "node:crypto";

const router = Router();

// Valid free activation codes (server-side only, never sent to client)
const VALID_ACTIVATION_CODES = ["Norv.ai.h52"];

// Simple in-memory rate limiting: max 5 attempts per user per 10 minutes
const attempts = new Map<number, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

function safeCompare(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// POST /api/access/activate
router.post("/access/activate", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const { code } = req.body;

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const now = Date.now();
  const entry = attempts.get(uid);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }
  if (!entry || entry.resetAt <= now) {
    attempts.set(uid, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
  }

  const valid = VALID_ACTIVATION_CODES.some((c) => safeCompare(c, code.trim()));
  if (!valid) {
    res.status(400).json({ error: "Invalid activation code" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ accessActivated: true })
    .where(eq(usersTable.id, uid))
    .returning();

  attempts.delete(uid);
  res.json({ activated: true, accessActivated: user.accessActivated });
});

export default router;

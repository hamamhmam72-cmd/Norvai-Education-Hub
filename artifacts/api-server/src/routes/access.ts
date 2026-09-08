import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import crypto from "node:crypto";
import {
  allowAbuseRequest,
  AbuseRateLimitUnavailableError,
  clearAbuseCounter,
} from "../lib/abuse-rate-limit.js";

const router = Router();

// Valid free activation codes (server-side only, never sent to client)
const VALID_ACTIVATION_CODES = ["Norv.ai.h52"];

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const activationLimitKey = (userId: number) => `activation-code:${userId}`;

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

  try {
    if (!await allowAbuseRequest(activationLimitKey(uid), MAX_ATTEMPTS, WINDOW_MS)) {
      res.status(429).json({ error: "Too many attempts. Try again later." });
      return;
    }
  } catch (error) {
    if (error instanceof AbuseRateLimitUnavailableError) {
      req.log?.error?.({ err: error, userId: uid }, "Activation-code rate-limit store unavailable");
      res.status(503).json({ error: "Activation limits are temporarily unavailable. Try again shortly." });
      return;
    }
    throw error;
  }

  const valid = VALID_ACTIVATION_CODES.some((c) => safeCompare(c, code.trim()));
  if (!valid) {
    res.status(400).json({ error: "Invalid activation code" });
    return;
  }

  const trialExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
  const [user] = await db
    .update(usersTable)
    .set({ accessActivated: true, trialExpiresAt })
    .where(eq(usersTable.id, uid))
    .returning();

  await clearAbuseCounter(activationLimitKey(uid));
  res.json({
    activated: true,
    accessActivated: user.accessActivated,
    trialExpiresAt: user.trialExpiresAt?.toISOString() ?? null,
  });
});

export default router;

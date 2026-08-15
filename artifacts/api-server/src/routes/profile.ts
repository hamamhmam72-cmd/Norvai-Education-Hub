import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function safeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    setupComplete: u.setupComplete,
    university: u.university,
    major: u.major,
    yearOfStudy: u.yearOfStudy,
    specialization: u.specialization,
    skillLevel: u.skillLevel,
    knownLanguages: u.knownLanguages,
    avatarUrl: u.avatarUrl,
    accessActivated: u.accessActivated,
    trialExpiresAt: u.trialExpiresAt?.toISOString() ?? null,
    subscriptionActive: u.subscriptionActive,
    subscriptionExpiry: u.subscriptionExpiry?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

// POST /api/profile/setup
router.post("/profile/setup", requireAuth, async (req, res) => {
  const {
    university,
    major,
    yearOfStudy,
    specialization,
    skillLevel,
    knownLanguages,
  } = req.body;
  const [user] = await db
    .update(usersTable)
    .set({
      university,
      major,
      yearOfStudy,
      specialization,
      skillLevel,
      knownLanguages: knownLanguages ?? [],
      setupComplete: true,
    })
    .where(eq(usersTable.id, req.user!.userId))
    .returning();
  res.json({ user: safeUser(user) });
});

// PATCH /api/profile
router.patch("/profile", requireAuth, async (req, res) => {
  const { fullName, university, major, yearOfStudy, specialization, skillLevel, knownLanguages, avatarUrl } = req.body;
  const updates: Record<string, unknown> = { fullName, university, major, yearOfStudy, specialization, skillLevel, knownLanguages };
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.user!.userId))
    .returning();
  res.json({ user: safeUser(user) });
});

// POST /api/profile/change-password
router.post("/profile/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, req.user!.userId));
  res.json({ message: "Password changed successfully" });
});

export default router;

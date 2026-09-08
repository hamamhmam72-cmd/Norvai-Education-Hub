import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { isStrongPassword, PASSWORD_REQUIREMENTS } from "../lib/credentials.js";

const router = Router();

function safeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    setupComplete: u.setupComplete,
    governorate: u.governorate,
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
    governorate,
    university,
    major,
    yearOfStudy,
    specialization,
  } = req.body;
  const cleanGovernorate = typeof governorate === "string" ? governorate.trim().slice(0, 100) : "";
  const cleanUniversity = typeof university === "string" ? university.trim().slice(0, 180) : "";
  const cleanMajor = typeof major === "string" ? major.trim().slice(0, 120) : "";
  const cleanSpecialization = typeof specialization === "string" ? specialization.trim().slice(0, 120) : "";
  const cleanYear = Number(yearOfStudy);
  if (!cleanGovernorate || !cleanUniversity || !cleanMajor || !cleanSpecialization
    || !Number.isInteger(cleanYear) || cleanYear < 1 || cleanYear > 6) {
    res.status(400).json({ error: "Complete all academic fields with valid values." });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set({
      university: cleanUniversity,
      governorate: cleanGovernorate,
      major: cleanMajor,
      yearOfStudy: cleanYear,
      specialization: cleanSpecialization,
      skillLevel: "beginner",
      knownLanguages: [],
      setupComplete: true,
    })
    .where(eq(usersTable.id, req.user!.userId))
    .returning();
  res.json({ user: safeUser(user) });
});

// PATCH /api/profile
router.patch("/profile", requireAuth, async (req, res) => {
  const { fullName, governorate, university, major, yearOfStudy, specialization, skillLevel, knownLanguages, avatarUrl } = req.body;
  const updates: Record<string, unknown> = { fullName, governorate, university, major, yearOfStudy, specialization, skillLevel, knownLanguages };
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
  if (typeof currentPassword !== "string" || !isStrongPassword(newPassword)) {
    res.status(400).json({ error: PASSWORD_REQUIREMENTS });
    return;
  }
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

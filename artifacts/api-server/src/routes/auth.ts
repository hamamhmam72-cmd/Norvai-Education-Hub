import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import {
  isStrongPassword,
  isValidFullName,
  isValidUsername,
  normalizeFullName,
  normalizeUsername,
  PASSWORD_REQUIREMENTS,
} from "../lib/credentials.js";

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

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const fullName = normalizeFullName(req.body?.fullName);
  const password = req.body?.password;
  if (!isValidFullName(fullName)) {
    res.status(400).json({ error: "Full name must be 2-80 letters and may contain spaces, apostrophes, or hyphens." });
    return;
  }
  if (!isValidUsername(username)) {
    res.status(400).json({ error: "Username must start with a letter and contain 3-30 letters, numbers, or underscores." });
    return;
  }
  if (!isStrongPassword(password)) {
    res.status(400).json({ error: PASSWORD_REQUIREMENTS });
    return;
  }
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ username, fullName, passwordHash })
    .returning();
  const token = signToken({ userId: user.id, username: user.username, role: user.role });
  res.status(201).json({ token, user: safeUser(user) });
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  if (!username || typeof password !== "string" || password.length > 72) {
    res.status(400).json({ error: "username and password required" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken({ userId: user.id, username: user.username, role: user.role });
  res.json({ token, user: safeUser(user) });
});

// POST /api/auth/logout
router.post("/auth/logout", requireAuth, (_req, res) => {
  res.json({ message: "Logged out" });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(safeUser(user));
});

export default router;

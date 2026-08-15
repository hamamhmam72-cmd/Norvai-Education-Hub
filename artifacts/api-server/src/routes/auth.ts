import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/jwt.js";
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
    subscriptionActive: u.subscriptionActive,
    subscriptionExpiry: u.subscriptionExpiry?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  const { username, password, fullName } = req.body;
  if (!username || !password || !fullName) {
    res.status(400).json({ error: "username, password, fullName required" });
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
  const { username, password } = req.body;
  if (!username || !password) {
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

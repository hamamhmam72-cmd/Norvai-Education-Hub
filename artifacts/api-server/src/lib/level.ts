import { db } from "@workspace/db";
import {
  completedLecturesTable,
  quizAttemptsTable,
  debugSessionsTable,
  conversationsTable,
  certificatesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export const LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
export type Level = (typeof LEVELS)[number];

// Points thresholds for each level
export const LEVEL_THRESHOLDS: Record<Level, number> = {
  beginner: 0,
  intermediate: 50,
  advanced: 150,
  expert: 300,
};

export interface ProgressInfo {
  points: number;
  level: Level;
  nextLevel: Level | null;
  nextLevelPoints: number | null;
  progressPercent: number;
  completedLevels: Level[];
  breakdown: {
    completedLectures: number;
    quizzesTaken: number;
    avgQuizScore: number;
    debugSessions: number;
    chatSessions: number;
  };
}

export async function computeProgress(userId: number): Promise<ProgressInfo> {
  const [completed, attempts, debugs, chats] = await Promise.all([
    db.select().from(completedLecturesTable).where(eq(completedLecturesTable.userId, userId)),
    db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.userId, userId)),
    db.select().from(debugSessionsTable).where(eq(debugSessionsTable.userId, userId)),
    db.select().from(conversationsTable).where(eq(conversationsTable.userId, userId)),
  ]);

  const avgScore = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + Number(a.percentage), 0) / attempts.length)
    : 0;

  const points =
    completed.length * 10 +
    attempts.length * 8 +
    debugs.length * 5 +
    chats.length * 2 +
    Math.round(avgScore / 5); // up to +20 bonus for high average

  let level: Level = "beginner";
  for (const l of LEVELS) {
    if (points >= LEVEL_THRESHOLDS[l]) level = l;
  }

  const levelIndex = LEVELS.indexOf(level);
  const nextLevel = levelIndex < LEVELS.length - 1 ? LEVELS[levelIndex + 1] : null;
  const nextLevelPoints = nextLevel ? LEVEL_THRESHOLDS[nextLevel] : null;

  const currentBase = LEVEL_THRESHOLDS[level];
  const progressPercent = nextLevelPoints
    ? Math.min(100, Math.round(((points - currentBase) / (nextLevelPoints - currentBase)) * 100))
    : 100;

  // A level is "completed" once the user has advanced past it.
  // Expert is the final level, so it counts as completed upon reaching it.
  const completedLevels = LEVELS.slice(
    0,
    level === "expert" ? levelIndex + 1 : levelIndex
  ) as Level[];

  return {
    points,
    level,
    nextLevel,
    nextLevelPoints,
    progressPercent,
    completedLevels,
    breakdown: {
      completedLectures: completed.length,
      quizzesTaken: attempts.length,
      avgQuizScore: avgScore,
      debugSessions: debugs.length,
      chatSessions: chats.length,
    },
  };
}

/** Auto-award certificates for every completed level that doesn't have one yet. */
export async function awardCertificates(userId: number, completedLevels: Level[]) {
  if (completedLevels.length === 0) return [];
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return [];
  const existing = await db
    .select()
    .from(certificatesTable)
    .where(eq(certificatesTable.userId, userId));
  const existingLevels = new Set(existing.map((c) => c.level));
  const awarded = [];
  for (const level of completedLevels) {
    if (existingLevels.has(level)) continue;
    const certificateNumber = `NORV-${level.toUpperCase().slice(0, 3)}-${userId}-${Date.now().toString(36).toUpperCase()}`;
    // onConflictDoNothing + unique(userId, level) guards against duplicate
    // awards from concurrent progress requests.
    const inserted = await db
      .insert(certificatesTable)
      .values({ userId, level, certificateNumber, studentName: user.fullName })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) awarded.push(inserted[0]);
  }
  return awarded;
}

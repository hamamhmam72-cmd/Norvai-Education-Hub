import { Router } from "express";
import { db } from "@workspace/db";
import {
  savedLecturesTable,
  completedLecturesTable,
  quizAttemptsTable,
  debugSessionsTable,
  lecturesTable,
} from "@workspace/db/schema";
import { eq, desc, avg } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { conversationsTable } from "@workspace/db/schema";

const router = Router();

// GET /api/dashboard/stats
router.get("/dashboard/stats", requireAuth, async (req, res) => {
  const uid = req.user!.userId;

  const [saved, completed, debugs] = await Promise.all([
    db.select().from(savedLecturesTable).where(eq(savedLecturesTable.userId, uid)),
    db.select().from(completedLecturesTable).where(eq(completedLecturesTable.userId, uid)),
    db.select().from(debugSessionsTable).where(eq(debugSessionsTable.userId, uid)),
  ]);

  const [attempts, chats] = await Promise.all([
    db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.userId, uid)),
    db.select().from(conversationsTable).where(eq(conversationsTable.userId, uid)),
  ]);

  const avgScore = attempts.length
    ? Math.round(attempts.reduce((sum, a) => sum + Number(a.percentage), 0) / attempts.length)
    : 0;

  res.json({
    savedLectures: saved.length,
    completedLectures: completed.length,
    chatSessions: chats.length,
    quizzesTaken: attempts.length,
    debugSessions: debugs.length,
    avgQuizScore: avgScore,
  });
});

// GET /api/dashboard/recent-activity
router.get("/dashboard/recent-activity", requireAuth, async (req, res) => {
  const uid = req.user!.userId;

  const [recentCompleted, recentDebug, recentAttempts] = await Promise.all([
    db
      .select({ lectureTitle: lecturesTable.title, completedAt: completedLecturesTable.createdAt })
      .from(completedLecturesTable)
      .innerJoin(lecturesTable, eq(completedLecturesTable.lectureId, lecturesTable.id))
      .where(eq(completedLecturesTable.userId, uid))
      .orderBy(desc(completedLecturesTable.createdAt))
      .limit(5),
    db
      .select()
      .from(debugSessionsTable)
      .where(eq(debugSessionsTable.userId, uid))
      .orderBy(desc(debugSessionsTable.createdAt))
      .limit(3),
    db
      .select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.userId, uid))
      .orderBy(desc(quizAttemptsTable.createdAt))
      .limit(3),
  ]);

  const activities = [
    ...recentCompleted.map((r) => ({
      type: "lecture_completed",
      description: `Completed: ${r.lectureTitle}`,
      timestamp: r.completedAt.toISOString(),
    })),
    ...recentDebug.map((d) => ({
      type: "debug_session",
      description: `Debugged ${d.language} code`,
      timestamp: d.createdAt.toISOString(),
    })),
    ...recentAttempts.map((a) => ({
      type: "quiz_attempt",
      description: `Quiz score: ${a.percentage}%`,
      timestamp: a.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

  res.json(activities);
});

// GET /api/dashboard/recommended-lectures
router.get("/dashboard/recommended-lectures", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  // Simple recommendation: lectures matching user's specialization that aren't completed
  const completed = await db
    .select({ lectureId: completedLecturesTable.lectureId })
    .from(completedLecturesTable)
    .where(eq(completedLecturesTable.userId, uid));
  const completedIds = completed.map((c) => c.lectureId);

  const lectures = await db
    .select()
    .from(lecturesTable)
    .where(eq(lecturesTable.isActive, true))
    .orderBy(desc(lecturesTable.createdAt))
    .limit(20);

  const recommended = lectures
    .filter((l) => !completedIds.includes(l.id))
    .slice(0, 6)
    .map((l) => ({
      id: l.id,
      title: l.title,
      youtubeId: l.youtubeId,
      youtubeUrl: l.youtubeUrl,
      instructor: l.instructor,
      description: l.description,
      specialization: l.specialization,
      difficulty: l.difficulty,
      durationMinutes: l.durationMinutes,
      curriculumId: l.curriculumId,
    }));

  res.json(recommended);
});

export default router;

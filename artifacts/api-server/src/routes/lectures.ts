import { Router } from "express";
import { db } from "@workspace/db";
import {
  lecturesTable,
  savedLecturesTable,
  completedLecturesTable,
} from "@workspace/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

function lectureWithMeta(l: typeof lecturesTable.$inferSelect) {
  return {
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
    isActive: l.isActive,
    createdAt: l.createdAt.toISOString(),
  };
}

// GET /api/lectures
router.get("/lectures", requireAuth, async (req, res) => {
  const { specialization, difficulty, curriculumId, q } = req.query as Record<string, string>;
  let query = db.select().from(lecturesTable).$dynamic();
  const conditions = [eq(lecturesTable.isActive, true)];
  if (specialization) conditions.push(eq(lecturesTable.specialization, specialization));
  if (difficulty) conditions.push(eq(lecturesTable.difficulty, difficulty));
  if (q) conditions.push(ilike(lecturesTable.title, `%${q}%`));
  
  const lectures = await db.select().from(lecturesTable)
    .where(and(...conditions));
  res.json(lectures.map(lectureWithMeta));
});

// POST /api/lectures (admin)
router.post("/lectures", requireAdmin, async (req, res) => {
  const { title, youtubeId, youtubeUrl, instructor, description, specialization, difficulty, durationMinutes, curriculumId } = req.body;
  const [lecture] = await db.insert(lecturesTable)
    .values({ title, youtubeId, youtubeUrl, instructor, description, specialization, difficulty: difficulty ?? "beginner", durationMinutes, curriculumId })
    .returning();
  res.status(201).json(lectureWithMeta(lecture));
});

// GET /api/lectures/:id
router.get("/lectures/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [lecture] = await db.select().from(lecturesTable).where(eq(lecturesTable.id, id)).limit(1);
  if (!lecture) { res.status(404).json({ error: "Lecture not found" }); return; }
  res.json(lectureWithMeta(lecture));
});

// PUT /api/lectures/:id (admin)
router.put("/lectures/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { title, youtubeId, youtubeUrl, instructor, description, specialization, difficulty, durationMinutes, curriculumId, isActive } = req.body;
  const [lecture] = await db.update(lecturesTable)
    .set({ title, youtubeId, youtubeUrl, instructor, description, specialization, difficulty, durationMinutes, curriculumId, isActive })
    .where(eq(lecturesTable.id, id))
    .returning();
  if (!lecture) { res.status(404).json({ error: "Lecture not found" }); return; }
  res.json(lectureWithMeta(lecture));
});

// DELETE /api/lectures/:id (admin)
router.delete("/lectures/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(lecturesTable).where(eq(lecturesTable.id, id));
  res.status(204).send();
});

// POST /api/lectures/:id/save
router.post("/lectures/:id/save", requireAuth, async (req, res) => {
  const lectureId = Number(req.params.id);
  const userId = req.user!.userId;
  const existing = await db.select().from(savedLecturesTable)
    .where(and(eq(savedLecturesTable.userId, userId), eq(savedLecturesTable.lectureId, lectureId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(savedLecturesTable).values({ userId, lectureId });
  }
  res.json({ saved: true });
});

// DELETE /api/lectures/:id/save
router.delete("/lectures/:id/save", requireAuth, async (req, res) => {
  const lectureId = Number(req.params.id);
  const userId = req.user!.userId;
  await db.delete(savedLecturesTable)
    .where(and(eq(savedLecturesTable.userId, userId), eq(savedLecturesTable.lectureId, lectureId)));
  res.json({ saved: false });
});

// POST /api/lectures/:id/complete
router.post("/lectures/:id/complete", requireAuth, async (req, res) => {
  const lectureId = Number(req.params.id);
  const userId = req.user!.userId;
  const existing = await db.select().from(completedLecturesTable)
    .where(and(eq(completedLecturesTable.userId, userId), eq(completedLecturesTable.lectureId, lectureId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(completedLecturesTable).values({ userId, lectureId });
  }
  res.json({ completed: true });
});

export default router;

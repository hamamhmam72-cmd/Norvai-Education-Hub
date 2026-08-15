import { Router } from "express";
import { db } from "@workspace/db";
import { curriculaTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/curricula
router.get("/curricula", requireAuth, async (_req, res) => {
  const curricula = await db.select().from(curriculaTable);
  res.json(
    curricula.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      specialization: c.specialization,
      createdAt: c.createdAt.toISOString(),
    }))
  );
});

// POST /api/curricula (admin)
router.post("/curricula", requireAdmin, async (req, res) => {
  const { name, description, specialization } = req.body;
  const [curriculum] = await db
    .insert(curriculaTable)
    .values({ name, description, specialization })
    .returning();
  res.status(201).json({
    id: curriculum.id,
    name: curriculum.name,
    description: curriculum.description,
    specialization: curriculum.specialization,
    createdAt: curriculum.createdAt.toISOString(),
  });
});

// PUT /api/curricula/:id (admin)
router.put("/curricula/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, specialization } = req.body;
  const [curriculum] = await db
    .update(curriculaTable)
    .set({ name, description, specialization })
    .where(eq(curriculaTable.id, id))
    .returning();
  if (!curriculum) {
    res.status(404).json({ error: "Curriculum not found" });
    return;
  }
  res.json({
    id: curriculum.id,
    name: curriculum.name,
    description: curriculum.description,
    specialization: curriculum.specialization,
    createdAt: curriculum.createdAt.toISOString(),
  });
});

// DELETE /api/curricula/:id (admin)
router.delete("/curricula/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(curriculaTable).where(eq(curriculaTable.id, id));
  res.status(204).send();
});

export default router;

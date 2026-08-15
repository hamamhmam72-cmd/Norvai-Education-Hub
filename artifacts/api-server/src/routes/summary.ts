import { Router } from "express";
import { db } from "@workspace/db";
import { summariesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/summaries
router.get("/summaries", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const summaries = await db
    .select()
    .from(summariesTable)
    .where(eq(summariesTable.userId, uid));
  res.json(
    summaries.map((s) => ({
      id: s.id,
      title: s.title,
      topic: s.topic,
      summary: s.summary,
      keyPoints: s.keyPoints,
      technicalTerms: s.technicalTerms,
      difficultyLevel: s.difficultyLevel,
      tags: s.tags,
      createdAt: s.createdAt.toISOString(),
    }))
  );
});

// POST /api/summaries
router.post("/summaries", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const { text, topic, title } = req.body;
  if (!text || text.length < 50) {
    res.status(400).json({ error: "text must be at least 50 characters" });
    return;
  }

  const prompt = `You are an expert IT/Software Engineering tutor. Analyze this text about "${topic}" and return a JSON response with exactly these fields:
{
  "summary": "concise 2-4 paragraph summary",
  "keyPoints": ["array", "of", "5-8", "key", "points"],
  "technicalTerms": ["important", "technical", "terms"],
  "difficultyLevel": "beginner|intermediate|advanced",
  "tags": ["relevant", "topic", "tags"]
}

Text to summarize:
${text}

Respond with valid JSON only.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });

    const raw = response.text ?? "{}";
    const parsed = JSON.parse(raw);

    const [summary] = await db
      .insert(summariesTable)
      .values({
        userId: uid,
        title: title ?? topic,
        topic,
        originalText: text,
        summary: parsed.summary ?? "",
        keyPoints: parsed.keyPoints ?? [],
        technicalTerms: parsed.technicalTerms ?? [],
        difficultyLevel: parsed.difficultyLevel ?? null,
        tags: parsed.tags ?? [],
      })
      .returning();

    res.status(201).json({
      id: summary.id,
      title: summary.title,
      topic: summary.topic,
      summary: summary.summary,
      keyPoints: summary.keyPoints,
      technicalTerms: summary.technicalTerms,
      difficultyLevel: summary.difficultyLevel,
      tags: summary.tags,
      createdAt: summary.createdAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

// GET /api/summaries/:id
router.get("/summaries/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const uid = req.user!.userId;
  const [summary] = await db
    .select()
    .from(summariesTable)
    .where(eq(summariesTable.id, id))
    .limit(1);
  if (!summary || summary.userId !== uid) {
    res.status(404).json({ error: "Summary not found" });
    return;
  }
  res.json({
    id: summary.id,
    title: summary.title,
    topic: summary.topic,
    summary: summary.summary,
    keyPoints: summary.keyPoints,
    technicalTerms: summary.technicalTerms,
    difficultyLevel: summary.difficultyLevel,
    tags: summary.tags,
    createdAt: summary.createdAt.toISOString(),
  });
});

// DELETE /api/summaries/:id
router.delete("/summaries/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const uid = req.user!.userId;
  await db
    .delete(summariesTable)
    .where(eq(summariesTable.id, id));
  res.status(204).send();
});

export default router;

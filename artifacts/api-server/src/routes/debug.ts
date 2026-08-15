import { Router } from "express";
import { db } from "@workspace/db";
import { debugSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/debug/analyze
router.post("/debug/analyze", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const { code, language } = req.body;
  if (!code || !language) {
    res.status(400).json({ error: "code and language are required" });
    return;
  }

  const prompt = `You are an expert code reviewer specializing in ${language}. Analyze this code and return a JSON response with exactly these fields:
{
  "status": "clean" or "has_errors",
  "efficiencyScore": number 0-100,
  "errors": [{"line": number, "message": "description", "severity": "error|warning|info"}],
  "explanation": "brief overall explanation",
  "bestPractices": ["list of improvement suggestions"],
  "fixedCode": "corrected version of the code if there are errors, otherwise same code"
}

Language: ${language}
Code:
\`\`\`${language}
${code}
\`\`\`

Respond with valid JSON only.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });

    const raw = response.text ?? "{}";
    const parsed = JSON.parse(raw);

    const [session] = await db
      .insert(debugSessionsTable)
      .values({
        userId: uid,
        language,
        code,
        status: parsed.status ?? "clean",
        efficiencyScore: parsed.efficiencyScore ?? null,
        errors: parsed.errors ?? [],
        explanation: parsed.explanation ?? null,
        bestPractices: parsed.bestPractices ?? [],
        fixedCode: parsed.fixedCode ?? null,
      })
      .returning();

    res.json({
      id: session.id,
      status: session.status,
      efficiencyScore: session.efficiencyScore,
      errors: session.errors,
      explanation: session.explanation,
      bestPractices: session.bestPractices,
      fixedCode: session.fixedCode,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to analyze code" });
  }
});

// GET /api/debug/sessions
router.get("/debug/sessions", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const sessions = await db
    .select()
    .from(debugSessionsTable)
    .where(eq(debugSessionsTable.userId, uid));
  res.json(
    sessions.map((s) => ({
      id: s.id,
      language: s.language,
      status: s.status,
      efficiencyScore: s.efficiencyScore,
      createdAt: s.createdAt.toISOString(),
    }))
  );
});

// GET /api/debug/sessions/:id
router.get("/debug/sessions/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [session] = await db
    .select()
    .from(debugSessionsTable)
    .where(eq(debugSessionsTable.id, id))
    .limit(1);
  if (!session || session.userId !== req.user!.userId) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({
    id: session.id,
    language: session.language,
    code: session.code,
    status: session.status,
    efficiencyScore: session.efficiencyScore,
    errors: session.errors,
    explanation: session.explanation,
    bestPractices: session.bestPractices,
    fixedCode: session.fixedCode,
    createdAt: session.createdAt.toISOString(),
  });
});

export default router;

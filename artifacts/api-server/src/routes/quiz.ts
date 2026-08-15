import { Router } from "express";
import { db } from "@workspace/db";
import { quizzesTable, quizAttemptsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// POST /api/quiz/generate
router.post("/quiz/generate", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const { material, topic, quizType, questionCount } = req.body;
  const count = Math.min(Math.max(Number(questionCount) || 5, 3), 15);

  const prompt = `You are an expert IT/Software Engineering exam creator. Generate a quiz based on the following material.

Topic: ${topic}
Quiz Type: ${quizType} (multiple_choice | true_false | coding | mixed)
Number of Questions: ${count}

Material:
${material}

Return a JSON object with exactly these fields:
{
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice" or "true_false" or "coding",
      "question": "question text",
      "options": ["A", "B", "C", "D"] (for multiple_choice, omit for others),
      "correctAnswer": "A" or true/false or "code answer",
      "explanation": "why this is the correct answer",
      "difficulty": "easy|medium|hard"
    }
  ]
}

Respond with valid JSON only.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });

    const raw = response.text ?? "{}";
    const parsed = JSON.parse(raw);

    const [quiz] = await db
      .insert(quizzesTable)
      .values({
        userId: uid,
        topic,
        quizType,
        questionCount: count,
        questions: parsed.questions ?? [],
      })
      .returning();

    res.status(201).json({
      id: quiz.id,
      topic: quiz.topic,
      quizType: quiz.quizType,
      questionCount: quiz.questionCount,
      questions: quiz.questions,
      createdAt: quiz.createdAt.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate quiz" });
  }
});

// GET /api/quiz
router.get("/quiz", requireAuth, async (req, res) => {
  const uid = req.user!.userId;
  const quizzes = await db
    .select()
    .from(quizzesTable)
    .where(eq(quizzesTable.userId, uid));
  res.json(
    quizzes.map((q) => ({
      id: q.id,
      topic: q.topic,
      quizType: q.quizType,
      questionCount: q.questionCount,
      createdAt: q.createdAt.toISOString(),
    }))
  );
});

// GET /api/quiz/:id
router.get("/quiz/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [quiz] = await db
    .select()
    .from(quizzesTable)
    .where(eq(quizzesTable.id, id))
    .limit(1);
  if (!quiz || quiz.userId !== req.user!.userId) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }
  res.json({
    id: quiz.id,
    topic: quiz.topic,
    quizType: quiz.quizType,
    questionCount: quiz.questionCount,
    questions: quiz.questions,
    createdAt: quiz.createdAt.toISOString(),
  });
});

// POST /api/quiz/:id/submit
router.post("/quiz/:id/submit", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const uid = req.user!.userId;
  const { answers } = req.body;

  const [quiz] = await db
    .select()
    .from(quizzesTable)
    .where(eq(quizzesTable.id, id))
    .limit(1);
  if (!quiz || quiz.userId !== uid) {
    res.status(404).json({ error: "Quiz not found" });
    return;
  }

  const questions = quiz.questions as Array<{
    id: number;
    correctAnswer: string | boolean;
    explanation?: string;
  }>;

  let score = 0;
  const feedback = questions.map((q, i) => {
    const userAnswer = answers?.[i];
    const correct =
      String(userAnswer).toLowerCase() === String(q.correctAnswer).toLowerCase();
    if (correct) score++;
    return {
      questionId: q.id,
      userAnswer,
      correctAnswer: q.correctAnswer,
      correct,
      explanation: q.explanation ?? "",
    };
  });

  const percentage = questions.length > 0 ? (score / questions.length) * 100 : 0;

  const [attempt] = await db
    .insert(quizAttemptsTable)
    .values({
      quizId: id,
      userId: uid,
      score,
      percentage: percentage.toFixed(2),
      answers: answers ?? [],
      feedback,
    })
    .returning();

  res.json({
    id: attempt.id,
    score,
    percentage: Number(attempt.percentage),
    total: questions.length,
    feedback,
    createdAt: attempt.createdAt.toISOString(),
  });
});

// GET /api/quiz/:id/attempts
router.get("/quiz/:id/attempts", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const uid = req.user!.userId;
  const attempts = await db
    .select()
    .from(quizAttemptsTable)
    .where(eq(quizAttemptsTable.quizId, id));
  res.json(
    attempts
      .filter((a) => a.userId === uid)
      .map((a) => ({
        id: a.id,
        score: a.score,
        percentage: Number(a.percentage),
        createdAt: a.createdAt.toISOString(),
      }))
  );
});

export default router;

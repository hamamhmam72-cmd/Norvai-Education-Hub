import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, quizAttemptsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@workspace/integrations-gemini-ai";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/career/recommendations
router.get("/career/recommendations", requireAuth, async (req, res) => {
  const uid = req.user!.userId;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, uid))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const attempts = await db
    .select()
    .from(quizAttemptsTable)
    .where(eq(quizAttemptsTable.userId, uid));
  const avgScore =
    attempts.length > 0
      ? Math.round(
          attempts.reduce((s, a) => s + Number(a.percentage), 0) /
            attempts.length
        )
      : 0;

  const prompt = `You are a career advisor for IT and Software Engineering students. Based on this student's profile, generate personalized career recommendations.

Student Profile:
- Name: ${user.fullName}
- Specialization: ${user.specialization ?? "General IT"}
- Skill Level: ${user.skillLevel ?? "beginner"}
- Known Languages: ${user.knownLanguages.join(", ") || "None specified"}
- Major: ${user.major ?? "Computer Science"}
- Year of Study: ${user.yearOfStudy ?? 1}
- Average Quiz Score: ${avgScore}%

Return a JSON object with exactly these fields:
{
  "careerPaths": [
    {
      "title": "career path name",
      "description": "brief description",
      "matchScore": 0-100,
      "salaryRange": "e.g. $60k-$120k",
      "growthOutlook": "high|medium|low",
      "requiredSkills": ["skill1", "skill2"],
      "timeToReady": "e.g. 6-12 months"
    }
  ],
  "learningMap": [
    {
      "phase": 1,
      "title": "phase title",
      "duration": "e.g. 2-3 months",
      "skills": ["skill1"],
      "resources": ["resource type"]
    }
  ],
  "suggestedLanguages": [
    {"language": "Python", "priority": "high|medium|low", "reason": "why"}
  ],
  "skillGaps": ["gap1", "gap2"],
  "immediateSteps": ["step1", "step2", "step3"]
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
    res.json({
      ...parsed,
      studentProfile: {
        specialization: user.specialization,
        skillLevel: user.skillLevel,
        knownLanguages: user.knownLanguages,
        avgQuizScore: avgScore,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate career recommendations" });
  }
});

export default router;

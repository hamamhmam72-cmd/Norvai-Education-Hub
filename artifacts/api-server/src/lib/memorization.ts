type JsonRecord = Record<string, unknown>;

export type StudyDeckContent = {
  bulletSummary: Array<{ heading: string; points: Array<{ text: string; keyTerms: string[] }> }>;
  flashcards: Array<{ id: string; front: string; back: string }>;
  fillBlanks: Array<{ id: string; prompt: string; answer: string; hint: string }>;
  quickQuiz: Array<{ id: string; type: "multiple_choice" | "true_false"; question: string; options: string[]; answer: string; explanation: string }>;
  examQuestions: Array<{ id: string; type: "multiple_choice" | "true_false" | "essay"; question: string; options: string[]; answer: string; explanation: string }>;
};

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const strings = (value: unknown, maxItems: number, maxLength: number) =>
  Array.isArray(value) ? value.map((item) => text(item, maxLength)).filter(Boolean).slice(0, maxItems) : [];

export function parseStudyDeckContent(raw: string): StudyDeckContent {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Study plan response did not contain JSON");
  const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object") throw new Error("Study plan response was invalid");
  const value = parsed as JsonRecord;

  const bulletSummary = (Array.isArray(value.bulletSummary) ? value.bulletSummary : [])
    .map((section) => {
      const item = section as JsonRecord;
      const points = (Array.isArray(item.points) ? item.points : []).map((point) => {
        const detail = point as JsonRecord;
        return { text: text(detail.text, 500), keyTerms: strings(detail.keyTerms, 8, 80) };
      }).filter((point) => point.text).slice(0, 10);
      return { heading: text(item.heading, 140), points };
    }).filter((section) => section.heading && section.points.length).slice(0, 10);

  const flashcards = (Array.isArray(value.flashcards) ? value.flashcards : [])
    .map((card, index) => {
      const item = card as JsonRecord;
      return { id: `card-${index + 1}`, front: text(item.front, 400), back: text(item.back, 1200) };
    }).filter((card) => card.front && card.back).slice(0, 30);

  const fillBlanks = (Array.isArray(value.fillBlanks) ? value.fillBlanks : [])
    .map((blank, index) => {
      const item = blank as JsonRecord;
      return { id: `blank-${index + 1}`, prompt: text(item.prompt, 700), answer: text(item.answer, 160), hint: text(item.hint, 180) };
    }).filter((blank) => blank.prompt.includes("____") && blank.answer).slice(0, 20);

  const normalizeQuestion = (
    question: unknown,
    index: number,
    allowedTypes: Array<"multiple_choice" | "true_false" | "essay">,
    prefix: string,
  ) => {
    const item = question as JsonRecord;
    const typeValue = allowedTypes.includes(item.type as never)
      ? item.type as "multiple_choice" | "true_false" | "essay"
      : allowedTypes[0];
    const options = typeValue === "true_false"
      ? ["True", "False"]
      : typeValue === "multiple_choice"
        ? strings(item.options, 4, 220)
        : [];
    return {
      id: `${prefix}-${index + 1}`,
      type: typeValue,
      question: text(item.question, 800),
      options,
      answer: text(item.answer, 1500),
      explanation: text(item.explanation, 1500),
    };
  };

  const quickQuiz = (Array.isArray(value.quickQuiz) ? value.quickQuiz : [])
    .map((question, index) => normalizeQuestion(question, index, ["multiple_choice", "true_false"], "quick"))
    .filter((question) => question.question && question.answer && (question.type !== "multiple_choice" || question.options.length === 4))
    .slice(0, 5) as StudyDeckContent["quickQuiz"];

  const examQuestions = (Array.isArray(value.examQuestions) ? value.examQuestions : [])
    .map((question, index) => normalizeQuestion(question, index, ["multiple_choice", "true_false", "essay"], "exam"))
    .filter((question) => question.question && question.answer && (question.type !== "multiple_choice" || question.options.length === 4))
    .slice(0, 60);

  if (!bulletSummary.length || flashcards.length < 3 || quickQuiz.length !== 5 || examQuestions.length < 5) {
    throw new Error("Study plan response was incomplete");
  }
  return { bulletSummary, flashcards, fillBlanks, quickQuiz, examQuestions };
}

export function nextReview(
  current: { reviewCount: number; correctCount: number; intervalDays: number; easeFactor: number },
  rating: "again" | "hard" | "good" | "easy",
) {
  const correct = rating !== "again";
  const reviewCount = current.reviewCount + 1;
  const correctCount = current.correctCount + (correct ? 1 : 0);
  const easeFactor = Math.max(1.3, Math.min(3.2, current.easeFactor + (
    rating === "easy" ? 0.15 : rating === "hard" ? -0.15 : rating === "again" ? -0.25 : 0
  )));
  const intervalDays = rating === "again"
    ? 0
    : current.intervalDays === 0
      ? 1
      : Math.max(1, Math.round(current.intervalDays * (rating === "hard" ? 1.2 : rating === "easy" ? easeFactor * 1.3 : easeFactor)));
  const dueAt = new Date(Date.now() + (intervalDays === 0 ? 10 * 60_000 : intervalDays * 86_400_000));
  return { reviewCount, correctCount, easeFactor, intervalDays, dueAt, lastReviewedAt: new Date() };
}
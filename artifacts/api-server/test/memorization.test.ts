import assert from "node:assert/strict";
import { createServer, request as httpRequest, type IncomingMessage, type Server } from "node:http";
import test from "node:test";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { memorizationDecksTable, flashcardProgressTable } from "@workspace/db/schema";
import { signToken } from "../src/lib/jwt.ts";
import { nextReview, parseStudyDeckContent, type StudyDeckContent } from "../src/lib/memorization.ts";
import { createMemorizationRouter } from "../src/routes/memorization.ts";
import type { db as productionDb } from "@workspace/db";

const deckOwnerId = 41;
const otherUserId = 42;

function completeDeckJson() {
  return JSON.stringify({
    bulletSummary: [{
      heading: "Core concepts",
      points: [{ text: "A concise concept", keyTerms: ["concept"] }],
    }],
    flashcards: Array.from({ length: 3 }, (_, index) => ({
      front: `Question ${index + 1}`,
      back: `Answer ${index + 1}`,
    })),
    fillBlanks: [{ prompt: "A ____ is important.", answer: "concept", hint: "Key term" }],
    quickQuiz: Array.from({ length: 5 }, (_, index) => ({
      type: index % 2 === 0 ? "multiple_choice" : "true_false",
      question: `Quick question ${index + 1}`,
      options: ["A", "B", "C", "D"],
      answer: index % 2 === 0 ? "A" : "True",
      explanation: "Because the source says so.",
    })),
    examQuestions: Array.from({ length: 5 }, (_, index) => ({
      type: index % 3 === 0 ? "essay" : index % 3 === 1 ? "true_false" : "multiple_choice",
      question: `Exam question ${index + 1}`,
      options: ["A", "B", "C", "D"],
      answer: index % 3 === 0 ? "An explanation" : index % 3 === 1 ? "True" : "A",
      explanation: "Because the source says so.",
    })),
  });
}

function examQuestions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `exam-${index + 1}`,
    type: (index % 3 === 0 ? "essay" : index % 3 === 1 ? "true_false" : "multiple_choice") as "essay" | "true_false" | "multiple_choice",
    question: `Question ${index + 1}`,
    options: index % 3 === 2 ? ["A", "B", "C", "D"] : index % 3 === 1 ? ["True", "False"] : [],
    answer: index % 3 === 0 ? "An explanation" : index % 3 === 1 ? "True" : "A",
    explanation: "Explanation",
  }));
}

const deck = {
  id: 7,
  userId: deckOwnerId,
  summaryId: null,
  title: "Owned deck",
  sourceLabel: "Test source",
  bulletSummary: [{ heading: "Summary", points: [{ text: "Point", keyTerms: [] }] }],
  flashcards: [{ id: "card-1", front: "Front", back: "Back" }],
  fillBlanks: [],
  quickQuiz: [],
  examQuestions: examQuestions(60),
  createdAt: new Date("2026-09-08T00:00:00.000Z"),
  updatedAt: new Date("2026-09-08T00:00:00.000Z"),
};

function conditionParams(condition: unknown) {
  return new PgDialect().sqlToQuery(condition as SQL).params;
}

class FakeDatabase {
  select() {
    return {
      from: (table: unknown) => ({
        where: (condition: unknown) => {
          const rows = this.rows(table, condition);
          return {
            limit: async () => rows.slice(0, 1),
            orderBy: async () => rows,
            then: (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
              Promise.resolve(rows).then(resolve, reject),
          };
        },
      }),
    };
  }

  insert() {
    throw new Error("The ownership tests must reject before inserting progress");
  }

  private rows(table: unknown, condition: unknown) {
    const params = conditionParams(condition);
    if (table === memorizationDecksTable) {
      const [requestedDeckId, requestedUserId] = params;
      return requestedDeckId === deck.id && requestedUserId === deck.userId ? [deck] : [];
    }
    if (table === flashcardProgressTable) return [];
    return [];
  }
}

type HttpResponse = { status: number; body: unknown };

function tokenFor(userId: number) {
  return signToken({ userId, username: `user-${userId}`, role: "student" });
}

function startTestServer(): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.use(createMemorizationRouter({
    database: new FakeDatabase() as unknown as typeof productionDb,
  }));
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, () => resolve(server));
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function readBody(response: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => { body += chunk; });
    response.on("end", () => resolve(body));
    response.on("error", reject);
  });
}

async function request(
  server: Server,
  method: string,
  path: string,
  userId: number,
  body?: unknown,
): Promise<HttpResponse> {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      port: address.port,
      method,
      path,
      headers: {
        authorization: `Bearer ${tokenFor(userId)}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
    }, async (response) => {
      try {
        const raw = await readBody(response);
        resolve({ status: response.statusCode ?? 0, body: raw ? JSON.parse(raw) : null });
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

test("accepts a complete AI deck and rejects malformed or incomplete output", () => {
  const parsed = parseStudyDeckContent(`Here is the plan:\n${completeDeckJson()}\n`);
  assert.deepEqual(parsed.flashcards.map((card) => card.id), ["card-1", "card-2", "card-3"]);
  assert.equal(parsed.quickQuiz.length, 5);
  assert.equal(parsed.examQuestions.length, 5);
  assert.deepEqual(parsed.quickQuiz[0].options, ["A", "B", "C", "D"]);

  assert.throws(() => parseStudyDeckContent("not JSON"), /did not contain JSON/);
  assert.throws(() => parseStudyDeckContent(JSON.stringify({
    ...JSON.parse(completeDeckJson()),
    flashcards: [{ front: "Only one", back: "Not enough cards" }],
  })), /incomplete/);
  assert.throws(() => parseStudyDeckContent(JSON.stringify({
    ...JSON.parse(completeDeckJson()),
    quickQuiz: [{ type: "multiple_choice", question: "Missing choices", answer: "A" }],
  })), /incomplete/);
});

test("keeps deck ownership enforced for read, review, and exam endpoints", async () => {
  const server = await startTestServer();
  try {
    const read = await request(server, "GET", "/memorization/decks/7", otherUserId);
    const review = await request(server, "POST", "/memorization/decks/7/cards/card-1/review", otherUserId, { rating: "good" });
    const exam = await request(server, "GET", "/memorization/decks/7/exam", otherUserId);
    assert.equal(read.status, 404);
    assert.equal(review.status, 404);
    assert.equal(exam.status, 404);

    const ownerRead = await request(server, "GET", "/memorization/decks/7", deckOwnerId);
    assert.equal(ownerRead.status, 200);
    assert.equal((ownerRead.body as { userId: number }).userId, deckOwnerId);
  } finally {
    await closeServer(server);
  }
});

test("schedules Again, Hard, Good, and Easy with the expected intervals", () => {
  const initial = { reviewCount: 0, correctCount: 0, intervalDays: 0, easeFactor: 2.5 };
  const now = Date.now();
  const again = nextReview(initial, "again");
  assert.equal(again.intervalDays, 0);
  assert.equal(again.reviewCount, 1);
  assert.equal(again.correctCount, 0);
  assert.equal(again.easeFactor, 2.25);
  assert.ok(again.dueAt.getTime() >= now + 10 * 60_000);

  const hard = nextReview(initial, "hard");
  assert.equal(hard.intervalDays, 1);
  assert.equal(hard.correctCount, 1);
  assert.equal(hard.easeFactor, 2.35);

  const good = nextReview(initial, "good");
  assert.equal(good.intervalDays, 1);
  assert.equal(good.correctCount, 1);
  assert.equal(good.easeFactor, 2.5);

  const easy = nextReview(initial, "easy");
  assert.equal(easy.intervalDays, 1);
  assert.equal(easy.correctCount, 1);
  assert.equal(easy.easeFactor, 2.65);

  assert.equal(nextReview({ ...initial, intervalDays: 2 }, "hard").intervalDays, 2);
  assert.equal(nextReview({ ...initial, intervalDays: 2 }, "good").intervalDays, 5);
  assert.equal(nextReview({ ...initial, intervalDays: 2 }, "easy").intervalDays, 7);
});

test("filters exam questions and enforces the five-to-forty count limits", async () => {
  const server = await startTestServer();
  try {
    const filtered = await request(server, "GET", "/memorization/decks/7/exam?count=2&types=true_false", deckOwnerId);
    assert.equal(filtered.status, 200);
    const filteredQuestions = (filtered.body as { questions: StudyDeckContent["examQuestions"] }).questions;
    assert.equal(filteredQuestions.length, 5);
    assert.ok(filteredQuestions.every((question) => question.type === "true_false"));

    const capped = await request(server, "GET", "/memorization/decks/7/exam?count=999", deckOwnerId);
    assert.equal(capped.status, 200);
    assert.equal((capped.body as { questions: StudyDeckContent["examQuestions"] }).questions.length, 40);
  } finally {
    await closeServer(server);
  }
});
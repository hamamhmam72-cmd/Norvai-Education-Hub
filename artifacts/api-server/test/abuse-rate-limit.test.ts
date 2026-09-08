import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createServer, type Server } from "node:http";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, like } from "drizzle-orm";
import express from "express";
import { db, pool } from "@workspace/db";
import * as schema from "@workspace/db/schema";
import {
  abuseRateLimitsTable,
  questionBankItemsTable,
  usersTable,
} from "@workspace/db/schema";
import {
  AbuseRateLimitUnavailableError,
  createAbuseRateLimiter,
} from "../src/lib/abuse-rate-limit.ts";
import accessRouter from "../src/routes/access.ts";
import studyRouter from "../src/routes/study.ts";
import { signToken } from "../src/lib/jwt.ts";

const keyPrefix = `abuse-regression:${process.pid}:${Date.now()}`;
let keyNumber = 0;
const pooledDatabaseA = drizzle(pool, { schema });
const pooledDatabaseB = drizzle(pool, { schema });

function nextKey(name: string) {
  keyNumber += 1;
  return `${keyPrefix}:${name}:${keyNumber}`;
}

async function startRouterServer(router: express.Router): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return server;
}

function serverUrl(server: Server) {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function removeKeys(databaseA: typeof db, databaseB: typeof db, ...keys: string[]) {
  for (const database of [databaseA, databaseB]) {
    for (const key of keys) {
      await database.delete(abuseRateLimitsTable)
        .where(eq(abuseRateLimitsTable.key, key));
    }
  }
}

after(async () => {
  await db.delete(abuseRateLimitsTable)
    .where(like(abuseRateLimitsTable.key, `${keyPrefix}%`));
  await pool.end();
});

test("allows exactly ten AI operations across separate database connections", async () => {
  const key = nextKey("ai");
  const now = new Date("2026-09-08T12:00:00.000Z");
  const connectionA = await pool.connect();
  const connectionB = await pool.connect();
  try {
    const { rows: rowsA } = await connectionA.query<{ pid: number }>("select pg_backend_pid() as pid");
    const { rows: rowsB } = await connectionB.query<{ pid: number }>("select pg_backend_pid() as pid");
    assert.notEqual(rowsA[0]?.pid, rowsB[0]?.pid);
  } finally {
    connectionA.release();
    connectionB.release();
  }

  const limiterA = createAbuseRateLimiter(pooledDatabaseA);
  const limiterB = createAbuseRateLimiter(pooledDatabaseB);
  try {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) => (
        (index % 2 === 0 ? limiterA : limiterB).allowAbuseRequest(
          key,
          10,
          60 * 60 * 1000,
          now,
        )
      )),
    );

    assert.equal(results.filter(Boolean).length, 10);
    assert.equal(results.filter((allowed) => !allowed).length, 10);
    const [counter] = await pooledDatabaseA.select()
      .from(abuseRateLimitsTable)
      .where(eq(abuseRateLimitsTable.key, key));
    assert.equal(counter?.count, 11);
  } finally {
    await removeKeys(pooledDatabaseA, pooledDatabaseB, key);
  }
});

test("allows exactly five activation attempts across separate database connections", async () => {
  const key = nextKey("activation");
  const now = new Date("2026-09-08T13:00:00.000Z");
  const limiterA = createAbuseRateLimiter(pooledDatabaseA);
  const limiterB = createAbuseRateLimiter(pooledDatabaseB);
  try {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) => (
        (index % 2 === 0 ? limiterA : limiterB).allowAbuseRequest(
          key,
          5,
          10 * 60 * 1000,
          now,
        )
      )),
    );

    assert.equal(results.filter(Boolean).length, 5);
    assert.equal(results.filter((allowed) => !allowed).length, 5);
  } finally {
    await removeKeys(pooledDatabaseA, pooledDatabaseB, key);
  }
});

test("material processing and question-bank quiz generation share one AI bucket", async () => {
  const key = nextKey("shared-ai");
  const now = new Date("2026-09-08T14:00:00.000Z");
  const database = pooledDatabaseA;
  try {
    const limiter = createAbuseRateLimiter(database);
    const materialResults = await Promise.all(
      Array.from({ length: 6 }, () => limiter.allowAbuseRequest(key, 10, 60 * 60 * 1000, now)),
    );
    const quizResults = await Promise.all(
      Array.from({ length: 5 }, () => limiter.allowAbuseRequest(key, 10, 60 * 60 * 1000, now)),
    );

    assert.equal(materialResults.filter(Boolean).length, 6);
    assert.equal(quizResults.filter(Boolean).length, 4);
    assert.equal(quizResults.filter((allowed) => !allowed).length, 1);
  } finally {
    await removeKeys(database, database, key);
  }
});

test("expired windows reset and opportunistically remove expired records", async () => {
  const key = nextKey("expired");
  const staleKey = nextKey("stale");
  const now = new Date("2026-09-08T15:00:00.000Z");
  const database = pooledDatabaseA;
  const limiter = createAbuseRateLimiter(database);

  await database.insert(abuseRateLimitsTable).values([
    {
      key,
      count: 10,
      expiresAt: new Date(now.getTime() - 1),
      updatedAt: new Date(now.getTime() - 10_000),
    },
    {
      key: staleKey,
      count: 3,
      expiresAt: new Date(now.getTime() - 2),
      updatedAt: new Date(now.getTime() - 10_000),
    },
  ]);

  try {
    assert.equal(await limiter.allowAbuseRequest(key, 10, 60 * 60 * 1000, now), true);
    const [counter] = await database.select()
      .from(abuseRateLimitsTable)
      .where(eq(abuseRateLimitsTable.key, key));
    const staleRows = await database.select()
      .from(abuseRateLimitsTable)
      .where(eq(abuseRateLimitsTable.key, staleKey));

    assert.equal(counter?.count, 1);
    assert.equal(counter?.expiresAt.toISOString(), "2026-09-08T16:00:00.000Z");
    assert.equal(staleRows.length, 0);
  } finally {
    await removeKeys(database, database, key, staleKey);
  }
});

test("fails closed when the rate-limit store is unavailable", async () => {
  let protectedWorkRan = false;
  const unavailableDatabase = {
    delete() {
      return {
        where: async () => {
          throw new Error("database unavailable");
        },
      };
    },
  } as unknown as typeof db;
  const limiter = createAbuseRateLimiter(unavailableDatabase);

  let responseStatus = 200;
  try {
    if (await limiter.allowAbuseRequest(nextKey("unavailable"), 10, 60 * 60 * 1000)) {
      protectedWorkRan = true;
    }
  } catch (error) {
    if (error instanceof AbuseRateLimitUnavailableError) {
      responseStatus = 503;
    } else {
      throw error;
    }
  }

  assert.equal(responseStatus, 503);
  assert.equal(protectedWorkRan, false);
});

test("preserves the material-processing and activation 429 response bodies", async () => {
  const userId = 2_000_000 + process.pid;
  const materialKey = `ai-hourly:${userId}`;
  const activationKey = `activation-code:${userId}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const materialServer = await startRouterServer(studyRouter);
  const accessServer = await startRouterServer(accessRouter);

  try {
    await db.insert(abuseRateLimitsTable).values([
      { key: materialKey, count: 10, expiresAt, updatedAt: new Date() },
      { key: activationKey, count: 5, expiresAt, updatedAt: new Date() },
    ]);
    const token = signToken({ userId, username: "abuse-route-test", role: "student" });
    const form = new FormData();
    form.append("file", new Blob(["test"], { type: "image/png" }), "material.png");
    const materialResponse = await fetch(`${serverUrl(materialServer)}/study/materials/process`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    const activationResponse = await fetch(`${serverUrl(accessServer)}/access/activate`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ code: "wrong-code" }),
    });

    assert.equal(materialResponse.status, 429);
    assert.deepEqual(await materialResponse.json(), {
      error: "Hourly material-processing limit reached. Try again later.",
    });
    assert.equal(activationResponse.status, 429);
    assert.deepEqual(await activationResponse.json(), {
      error: "Too many attempts. Try again later.",
    });
  } finally {
    await closeServer(materialServer);
    await closeServer(accessServer);
    await removeKeys(pooledDatabaseA, pooledDatabaseB, materialKey, activationKey);
  }
});

test("preserves the question-bank quiz 429 response body", async () => {
  const username = `abuse-quiz-${process.pid}-${keyNumber}`;
  const [user] = await db.insert(usersTable).values({
    username,
    fullName: "Abuse regression test",
    passwordHash: "not-a-real-password",
    university: "Regression University",
    major: "Regression Major",
  }).returning({ id: usersTable.id });
  if (!user) throw new Error("Could not create quiz rate-limit test user");

  const itemRows = await db.insert(questionBankItemsTable).values(
    Array.from({ length: 3 }, (_, index) => ({
      userId: user.id,
      university: "Regression University",
      major: "Regression Major",
      course: "Regression Course",
      prompt: `Question ${index + 1}`,
      answer: `Answer ${index + 1}`,
      sourceLabel: "rate-limit regression",
    })),
  ).returning({ id: questionBankItemsTable.id });
  const key = `ai-hourly:${user.id}`;
  const server = await startRouterServer(studyRouter);

  try {
    await db.insert(abuseRateLimitsTable).values({
      key,
      count: 10,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      updatedAt: new Date(),
    });
    const response = await fetch(`${serverUrl(server)}/question-bank/quiz`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${signToken({ userId: user.id, username, role: "student" })}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ course: "Regression Course" }),
    });

    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), {
      error: "Hourly AI limit reached. Try again later.",
    });
  } finally {
    await closeServer(server);
    await removeKeys(pooledDatabaseA, pooledDatabaseB, key);
    for (const row of itemRows) {
      await db.delete(questionBankItemsTable)
        .where(eq(questionBankItemsTable.id, row.id));
    }
    await db.delete(usersTable).where(eq(usersTable.id, user.id));
  }
});
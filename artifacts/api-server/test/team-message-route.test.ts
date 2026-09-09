import assert from "node:assert/strict";
import { createServer, request as httpRequest, type IncomingHttpHeaders, type Server } from "node:http";
import test from "node:test";
import express from "express";
import { signToken } from "../src/lib/jwt.ts";
import { TeamMessageRateLimitUnavailableError } from "../src/lib/team-message-rate-limit.ts";
import { createTeamMessageHandler } from "../src/routes/study.ts";
import { requireAuth } from "../src/middleware/auth.ts";
import { getTeamMessageLimitTelemetry } from "../src/lib/logger.ts";

type HttpResponse = {
  status: number;
  body: unknown;
  headers: IncomingHttpHeaders;
};

const userId = 73;
const projectId = 19;

function token() {
  return signToken({ userId, username: "route-test-user", role: "student" });
}

function startTestServer(options: {
  consumeLimit: (requestedUserId: number) => Promise<boolean>;
  createMessage: (input: {
    projectId: number;
    userId: number;
    content: string | null;
    imageUrl: string | null;
  }) => Promise<unknown>;
}): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.post("/team/projects/:id/messages", requireAuth, createTeamMessageHandler({
    getMembership: async () => ({ id: 1, role: "editor" }),
    consumeLimit: options.consumeLimit,
    createMessage: options.createMessage,
    broadcast: () => undefined,
  }));
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, () => resolve(server));
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function readBody(response: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => { body += chunk; });
    response.on("end", () => resolve(body));
    response.on("error", reject);
  });
}

function postMessage(server: Server, body: unknown = { content: "A valid team message" }): Promise<HttpResponse> {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      port: address.port,
      method: "POST",
      path: `/team/projects/${projectId}/messages`,
      headers: {
        authorization: `Bearer ${token()}`,
        "content-type": "application/json",
      },
    }, async (response) => {
      try {
        const raw = await readBody(response);
        resolve({
          status: response.statusCode ?? 0,
          body: raw ? JSON.parse(raw) : null,
          headers: response.headers,
        });
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

test("invalid message payloads return 400 without consuming the shared quota", async () => {
  let consumed = 0;
  let inserts = 0;
  const server = await startTestServer({
    consumeLimit: async () => {
      consumed += 1;
      return consumed <= 30;
    },
    createMessage: async (input) => {
      inserts += 1;
      return { id: inserts, ...input, createdAt: new Date().toISOString() };
    },
  });

  try {
    for (const body of [
      {},
      { content: "   " },
      { content: 42 },
      { imageUrl: "/objects/not-an-object-id" },
      { imageUrl: "https://example.com/image.png" },
    ]) {
      const response = await postMessage(server, body);
      assert.equal(response.status, 400);
      assert.deepEqual(response.body, { error: "A message or image is required" });
    }
    assert.equal(consumed, 0);
    assert.equal(inserts, 0);

    for (let index = 0; index < 30; index += 1) {
      const response = await postMessage(server);
      assert.equal(response.status, 201);
    }
    assert.equal(consumed, 30);
    assert.equal(inserts, 30);
    assert.equal((await postMessage(server)).status, 429);
  } finally {
    await closeServer(server);
  }
});

test("returns the existing 429 contract after 30 accepted messages", async () => {
  let consumed = 0;
  let inserts = 0;
  const server = await startTestServer({
    consumeLimit: async () => ++consumed <= 30,
    createMessage: async (input) => {
      inserts += 1;
      return { id: inserts, ...input, createdAt: new Date().toISOString() };
    },
  });

  try {
    for (let index = 0; index < 30; index += 1) {
      const response = await postMessage(server);
      assert.equal(response.status, 201);
    }
    const limited = await postMessage(server);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers["retry-after"], "60");
    assert.deepEqual(limited.body, { error: "Message limit reached. Try again shortly." });
    assert.equal(inserts, 30);
  } finally {
    await closeServer(server);
  }
});

test("fails closed with 503 and never inserts when the limiter store fails", async () => {
  let inserts = 0;
  const failuresBefore = getTeamMessageLimitTelemetry().storeFailures;
  const server = await startTestServer({
    consumeLimit: async () => {
      throw new TeamMessageRateLimitUnavailableError(new Error("database unavailable"));
    },
    createMessage: async () => {
      inserts += 1;
      return { id: inserts };
    },
  });

  try {
    const response = await postMessage(server);
    assert.equal(response.status, 503);
    assert.deepEqual(response.body, {
      error: "Message limits are temporarily unavailable. Try again shortly.",
    });
    assert.equal(inserts, 0);
    assert.equal(getTeamMessageLimitTelemetry().storeFailures, failuresBefore + 1);
  } finally {
    await closeServer(server);
  }
});
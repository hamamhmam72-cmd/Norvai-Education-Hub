import test from "node:test";
import assert from "node:assert/strict";
import { createServer, request as httpRequest, type AddressInfo, type Server } from "node:http";
import express from "express";
import { db } from "@workspace/db";
import {
  teamMessageRateLimitsTable,
  teamMessagesTable,
  teamProjectMembersTable,
  teamProjectsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  canAccessTeamProject,
  canEditTeamProject,
  saveTeamCodeWithVersion,
  type TeamCodeSnapshot,
} from "../src/lib/team-collaboration.ts";
import { createTeamRealtimeHub } from "../src/lib/team-realtime-hub.ts";
import { attachTeamRealtime } from "../src/lib/team-realtime.ts";
import { signToken } from "../src/lib/jwt.ts";
import studyRouter from "../src/routes/study.ts";
import {
  mergeTeamMessages,
  type TeamMessage,
} from "../../norv-ai/src/lib/team-collaboration.ts";
import { WebSocket } from "ws";

const teamUser = { role: "student", subscriptionActive: true, subscriptionTier: "team" };
const viewer = { role: "viewer" };
const membership = { role: "editor" };

function message(id: number, imageUrl: string | null = null): TeamMessage {
  return {
    id,
    userId: 7,
    content: `message ${id}`,
    imageUrl,
    createdAt: `2026-09-08T00:00:0${id}.000Z`,
  };
}

test("authorized Team members receive message and attachment events immediately", () => {
  assert.equal(canAccessTeamProject(teamUser, membership), true);
  const hub = createTeamRealtimeHub();
  const received: string[][] = [[], []];
  const sockets = received.map((events) => ({
    readyState: WebSocket.OPEN,
    send(payload: string) { events.push(payload); },
  }));
  const remove = sockets.map((socket, index) => (
    hub.addSubscriber(12, 100 + index, socket as unknown as WebSocket)
  ));

  hub.broadcast({
    type: "message.created",
    projectId: 12,
    message: message(1, "/objects/attachment-id"),
  });

  for (const events of received) {
    assert.equal(events.length, 1);
    assert.deepEqual(JSON.parse(events[0]), {
      type: "message.created",
      projectId: 12,
      message: message(1, "/objects/attachment-id"),
    });
  }
  assert.equal(hub.subscriberCount(12), 2);
  remove.forEach((cleanup) => cleanup());
  assert.equal(hub.subscriberCount(12), 0);
});

test("reconnect rehydration and live delivery do not duplicate persisted messages", () => {
  const initial = [message(1)];
  const rehydrated = [message(1), message(2)];
  const liveAfterReconnect = [message(2), message(3)];
  const merged = mergeTeamMessages(
    mergeTeamMessages(initial, rehydrated),
    liveAfterReconnect,
  );

  assert.deepEqual(merged.map((item) => item.id), [1, 2, 3]);
  assert.equal(new Set(merged.map((item) => item.id)).size, merged.length);
});

test("simultaneous saves accept one version and return the current version to the stale editor", async () => {
  let current: TeamCodeSnapshot = {
    id: 12,
    sharedCode: "initial",
    codeLanguage: "TypeScript",
    codeVersion: 1,
    updatedAt: "2026-09-08T00:00:00.000Z",
  };
  const store = {
    async updateIfVersion(input: { projectId: number; code: string; codeLanguage: string; expectedVersion: number }) {
      if (current.codeVersion !== input.expectedVersion) return null;
      current = {
        ...current,
        sharedCode: input.code,
        codeLanguage: input.codeLanguage,
        codeVersion: current.codeVersion + 1,
      };
      return current;
    },
    async getCurrent() {
      return current;
    },
  };

  const [first, second] = await Promise.all([
    saveTeamCodeWithVersion(store, { projectId: 12, code: "first", codeLanguage: "TypeScript", expectedVersion: 1 }),
    saveTeamCodeWithVersion(store, { projectId: 12, code: "second", codeLanguage: "TypeScript", expectedVersion: 1 }),
  ]);
  const results = [first, second];

  assert.equal(results.filter((result) => result.status === 200).length, 1);
    const conflict = saves.find((response) => response.status === 409);

type ApiResponse = {
  status: number;
  body: any;
};
    assert.ok(conflict);
    assert.equal(conflict.body.error, "Newer shared code is available");
    assert.equal(conflict.body.current.codeVersion, 2);
    assert.equal(conflict.body.current.sharedCode, saves.find((response) => response.status === 200)?.body.sharedCode);
  } finally {
    ownerWebSocket?.terminate();
    viewerWebSocket?.terminate();
    ownerSocket.socket.terminate();
    viewerSocket.socket.terminate();
    await closeTeamFixture(fixture);
  }
});

  let ownerWebSocket: WebSocket | undefined;

const fixturePrefix = `team-db-${process.pid}-${Date.now()}`;

    const persistedImage = await apiRequest(
      fixture.server,
      fixture.tokens.owner,
      "POST",
      `/api/team/projects/${fixture.projectId}/messages`,
      { imageUrl: "/objects/123e4567-e89b-12d3-a456-426614174000" },
    );

    const messages = await apiRequest(
      fixture.server,
      fixture.tokens.viewer,
      "GET",
      `/api/team/projects/${fixture.projectId}/messages`,
    );

    const individualSocketStatus = await rejectedTeamSocket(fixture.server, fixture.tokens.individual, fixture.projectId);

type TeamFixture = {
  ownerId: number;
  editorId: number;
  viewerId: number;
  individualId: number;
  projectId: number;
  server: Server;
  tokens: {
    owner: string;
    editor: string;
    viewer: string;
    individual: string;
  };
};

  let viewerWebSocket: WebSocket | undefined;

    const persistedMessage = await apiRequest(
      fixture.server,
      fixture.tokens.owner,
      "POST",
      `/api/team/projects/${fixture.projectId}/messages`,
      { content: "Persisted database message" },
    );

    const viewerSave = await apiRequest(
      fixture.server,
      fixture.tokens.viewer,
      "PUT",
      `/api/team/projects/${fixture.projectId}/code`,
      { code: "viewer cannot save", language: "TypeScript", expectedVersion: 1 },
    );

async function closeTeamFixture(fixture: TeamFixture) {
  fixture.server.close();
  fixture.server.closeAllConnections?.();
  fixture.server.closeIdleConnections?.();
  await new Promise((resolve) => setImmediate(resolve));
  await db.delete(teamMessageRateLimitsTable).where(eq(teamMessageRateLimitsTable.userId, fixture.ownerId));
  await db.delete(teamMessagesTable).where(eq(teamMessagesTable.projectId, fixture.projectId));
  await db.delete(teamProjectMembersTable).where(eq(teamProjectMembersTable.projectId, fixture.projectId));
  await db.delete(teamProjectsTable).where(eq(teamProjectsTable.id, fixture.projectId));
  await db.delete(usersTable).where(eq(usersTable.id, fixture.ownerId));
  await db.delete(usersTable).where(eq(usersTable.id, fixture.editorId));
  await db.delete(usersTable).where(eq(usersTable.id, fixture.viewerId));
  await db.delete(usersTable).where(eq(usersTable.id, fixture.individualId));
}

    const individualRead = await apiRequest(
      fixture.server,
      fixture.tokens.individual,
      "GET",
      `/api/team/projects/${fixture.projectId}/messages`,
    );

function rejectedTeamSocket(server: Server, token: string, projectId: number) {
  return new Promise<number>((resolve) => {
    const request = httpRequest({
      port: serverPort(server),
      path: `/api/team/live?projectId=${projectId}`,
      headers: {
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": "13",
        "sec-websocket-key": "MTIzNDU2Nzg5MGFiY2RlZg==",
        "sec-websocket-protocol": `norv-team, ${token}`,
      },
    }, (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    request.on("upgrade", (_response, socket) => {
      socket.destroy();
      resolve(101);
    });
    request.on("error", () => resolve(0));
    request.end();
  });
}

    const saves = await Promise.all([
      apiRequest(
        fixture.server,
        fixture.tokens.owner,
        "PUT",
        `/api/team/projects/${fixture.projectId}/code`,
        { code: "const winner = 1;", language: "TypeScript", expectedVersion: 1 },
      ),
      apiRequest(
        fixture.server,
        fixture.tokens.editor,
        "PUT",
        `/api/team/projects/${fixture.projectId}/code`,
        { code: "const winner = 2;", language: "TypeScript", expectedVersion: 1 },
      ),
    ]);

  const viewerSocket = openTeamSocket(fixture.server, fixture.tokens.viewer, fixture.projectId);

function serverPort(server: Server) {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return (address as AddressInfo).port;
}

function openTeamSocket(server: Server, token: string, projectId: number) {
  const events: any[] = [];
  const socket = new WebSocket(
    `ws://127.0.0.1:${serverPort(server)}/api/team/live?projectId=${projectId}`,
    ["norv-team", token],
  );
  socket.on("message", (payload) => events.push(JSON.parse(payload.toString())));
  const opened = new Promise<WebSocket>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out opening team WebSocket")), 5_000);
    socket.once("open", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("error", reject);
  });
  return { socket, events, opened };
}

function tokenForUser(userId: number, username: string) {
  return signToken({ userId, username, role: "student" });
}

  const ownerSocket = openTeamSocket(fixture.server, fixture.tokens.owner, fixture.projectId);

async function apiRequest(
  server: Server,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResponse> {
  const response = await fetch(`http://127.0.0.1:${serverPort(server)}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  return {
    status: response.status,
    body: raw ? JSON.parse(raw) : null,
  };
}

  const fixture = await createTeamFixture();

async function createTeamFixture(): Promise<TeamFixture> {
  const users = await db.insert(usersTable).values([
    {
      username: `${fixturePrefix}-owner`,
      fullName: "Database Team Owner",
      passwordHash: "test-only",
      university: "Database University",
      major: "Database Engineering",
      setupComplete: true,
      subscriptionActive: true,
      subscriptionTier: "team",
    },
    {
      username: `${fixturePrefix}-editor`,
      fullName: "Database Team Editor",
      passwordHash: "test-only",
      university: "Database University",
      major: "Database Engineering",
      setupComplete: true,
      subscriptionActive: true,
      subscriptionTier: "team",
    },
    {
      username: `${fixturePrefix}-viewer`,
      fullName: "Database Team Viewer",
      passwordHash: "test-only",
      university: "Database University",
      major: "Database Engineering",
      setupComplete: true,
      subscriptionActive: true,
      subscriptionTier: "team",
    },
    {
      username: `${fixturePrefix}-individual`,
      fullName: "Database Individual User",
      passwordHash: "test-only",
      university: "Database University",
      major: "Database Engineering",
      setupComplete: true,
      subscriptionActive: true,
      subscriptionTier: "individual",
    },
  ]).returning({
    id: usersTable.id,
    username: usersTable.username,
  });
  const [owner, editor, viewerUser, individual] = users;

  const [project] = await db.insert(teamProjectsTable).values({
    ownerId: owner.id,
    university: "Database University",
    major: "Database Engineering",
    name: `${fixturePrefix}-project`,
    sharedCode: "const initial = true;",
    codeLanguage: "TypeScript",
    codeVersion: 1,
  }).returning({ id: teamProjectsTable.id });

  await db.insert(teamProjectMembersTable).values([
    { projectId: project.id, userId: owner.id, role: "owner" },
    { projectId: project.id, userId: editor.id, role: "editor" },
    { projectId: project.id, userId: viewerUser.id, role: "viewer" },
  ]);

  const integrationApp = express();
  integrationApp.use(express.json());
  integrationApp.use("/api", studyRouter);
  const server = createServer(integrationApp);
  attachTeamRealtime(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  return {
    ownerId: owner.id,
    editorId: editor.id,
    viewerId: viewerUser.id,
    individualId: individual.id,
    projectId: project.id,
    server,
    tokens: {
      owner: tokenForUser(owner.id, owner.username),
      editor: tokenForUser(editor.id, editor.username),
      viewer: tokenForUser(viewerUser.id, viewerUser.username),
      individual: tokenForUser(individual.id, individual.username),
    },
  };
}

async function waitForEvents(events: any[], count: number) {
  const deadline = Date.now() + 5_000;
  while (events.length < count && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(events.length >= count, `Expected ${count} WebSocket events, received ${events.length}`);
}

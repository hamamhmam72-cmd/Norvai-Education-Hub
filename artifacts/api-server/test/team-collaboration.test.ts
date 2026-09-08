import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessTeamProject,
  canEditTeamProject,
  saveTeamCodeWithVersion,
  type TeamCodeSnapshot,
} from "../src/lib/team-collaboration.ts";
import { createTeamRealtimeHub } from "../src/lib/team-realtime-hub.ts";
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
  const conflict = results.find((result) => result.status === 409);
  assert.ok(conflict);
  if (conflict?.status === 409) assert.equal(conflict.current.codeVersion, 2);
  assert.equal(current.codeVersion, 2);
});

test("viewers and non-Team users cannot subscribe or save", () => {
  assert.equal(canAccessTeamProject(teamUser, { role: "viewer" }), true);
  assert.equal(canEditTeamProject(teamUser, viewer), false);
  assert.equal(canAccessTeamProject({ role: "student", subscriptionActive: true, subscriptionTier: "individual" }, membership), false);
  assert.equal(canEditTeamProject({ role: "student", subscriptionActive: true, subscriptionTier: "individual" }, membership), false);
});
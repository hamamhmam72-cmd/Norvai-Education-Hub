import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import {
  canAccessTeamProject,
  canEditTeamProject,
  saveTeamCodeWithVersion,
  type TeamCodeSnapshot,
} from "../src/lib/team-collaboration.ts";
import { createTeamRealtimeHub } from "../src/lib/team-realtime-hub.ts";
import {
  nextEntitlementCheckDelay,
  parsePubSubEvent,
  teamAccessRevocationReason,
} from "../src/lib/team-realtime.ts";
import {
  mergeTeamMessages,
  shouldReconnectTeamSocket,
  teamAccessRevocationMessage,
  type TeamMessage,
} from "../../norv-ai/src/lib/team-collaboration.ts";

const teamUser = { role: "student", subscriptionActive: true, subscriptionTier: "team" };
const membership = { role: "editor" };

function message(id: number): TeamMessage {
  return {
    id,
    userId: 7,
    content: `message ${id}`,
    imageUrl: null,
    createdAt: `2026-09-08T00:00:0${id}.000Z`,
  };
}

function trackedSocket() {
  const events: string[] = [];
  const closes: Array<{ code: number; reason: string }> = [];
  const socket = {
    readyState: WebSocket.OPEN,
    send(payload: string) { events.push(payload); },
    close(code: number, reason: string) {
      closes.push({ code, reason });
      this.readyState = WebSocket.CLOSED;
    },
  };
  return { socket: socket as unknown as WebSocket, events, closes };
}

test("revoked Team access closes once, blocks later broadcasts, and permits manual reconnection", () => {
  const hub = createTeamRealtimeHub();
  const first = trackedSocket();
  hub.addSubscriber(12, 101, first.socket);

  hub.broadcast({ type: "message.created", projectId: 12, message: message(1) });
  hub.broadcast({
    type: "code.updated",
    projectId: 12,
    code: { codeVersion: 2, sharedCode: "const live = true;" },
  });
  assert.equal(first.events.length, 2);

  hub.revokeAccess(101, 12, "TEAM_MEMBERSHIP_REMOVED");
  assert.deepEqual(first.closes, [{ code: 4403, reason: "TEAM_MEMBERSHIP_REMOVED" }]);
  assert.equal(hub.subscriberCount(12), 0);

  hub.broadcast({ type: "message.created", projectId: 12, message: message(2) });
  assert.equal(first.events.length, 2);

  const restored = trackedSocket();
  hub.addSubscriber(12, 101, restored.socket);
  hub.broadcast({ type: "message.created", projectId: 12, message: message(3) });
  assert.equal(restored.events.length, 1);
  assert.equal(first.events.length, 2);
});

test("membership removal, subscription downgrade, and expiry carry distinct safe reasons", () => {
  const hub = createTeamRealtimeHub();
  const cases = [
    { user: teamUser, member: null, reason: "TEAM_MEMBERSHIP_REMOVED" as const },
    { user: { ...teamUser, subscriptionTier: "individual" }, member: membership, reason: "TEAM_PLAN_DOWNGRADED" as const },
    { user: { ...teamUser, subscriptionExpiry: new Date(Date.now() - 1_000) }, member: membership, reason: "TEAM_SUBSCRIPTION_EXPIRED" as const },
  ];

  cases.forEach(({ user, member, reason }, index) => {
    const tracked = trackedSocket();
    const userId = 200 + index;
    hub.addSubscriber(12, userId, tracked.socket);
    assert.equal(canAccessTeamProject(user, member), false);
    assert.equal(teamAccessRevocationReason(user, Boolean(member)), reason);
    hub.revokeAccess(userId, 12, reason);
    assert.deepEqual(tracked.closes, [{ code: 4403, reason }]);
    assert.notEqual(teamAccessRevocationMessage(reason), teamAccessRevocationMessage(""));
  });
});

test("safe revocation reasons survive cross-server pub/sub serialization", () => {
  for (const reason of [
    "TEAM_MEMBERSHIP_REMOVED",
    "TEAM_PLAN_DOWNGRADED",
    "TEAM_SUBSCRIPTION_EXPIRED",
  ] as const) {
    assert.deepEqual(parsePubSubEvent(JSON.stringify({
      type: "access.revoked",
      userId: 201,
      projectId: 12,
      reason,
    })), {
      type: "access.revoked",
      userId: 201,
      projectId: 12,
      reason,
    });
  }
  assert.equal(parsePubSubEvent(JSON.stringify({
    type: "access.revoked",
    userId: 201,
    projectId: 12,
    reason: "PRIVATE_ACCOUNT_DETAIL",
  })), null);
});

test("Study Hub never auto-reconnects after the security close code", () => {
  assert.equal(shouldReconnectTeamSocket(4403), false);
  assert.equal(shouldReconnectTeamSocket(1006), true);
  assert.equal(shouldReconnectTeamSocket(1012), true);
});

test("project entitlement checks are jittered instead of firing in one synchronized spike", () => {
  assert.equal(nextEntitlementCheckDelay(0), 12_000);
  assert.equal(nextEntitlementCheckDelay(0.5), 15_000);
  assert.equal(nextEntitlementCheckDelay(1), 18_000);
  assert.equal(nextEntitlementCheckDelay(-1), 12_000);
  assert.equal(nextEntitlementCheckDelay(2), 18_000);
});

test("reconnect rehydration and live delivery do not duplicate persisted messages", () => {
  const merged = mergeTeamMessages(
    mergeTeamMessages([message(1)], [message(1), message(2)]),
    [message(2), message(3)],
  );
  assert.deepEqual(merged.map((item) => item.id), [1, 2, 3]);
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
    async updateIfVersion(input: { code: string; codeLanguage: string; expectedVersion: number }) {
      if (current.codeVersion !== input.expectedVersion) return null;
      current = {
        ...current,
        sharedCode: input.code,
        codeLanguage: input.codeLanguage,
        codeVersion: current.codeVersion + 1,
      };
      return current;
    },
    async getCurrent() { return current; },
  };

  const results = await Promise.all([
    saveTeamCodeWithVersion(store, { projectId: 12, code: "first", codeLanguage: "TypeScript", expectedVersion: 1 }),
    saveTeamCodeWithVersion(store, { projectId: 12, code: "second", codeLanguage: "TypeScript", expectedVersion: 1 }),
  ]);
  assert.equal(results.filter((result) => result.status === 200).length, 1);
  const conflict = results.find((result) => result.status === 409);
  assert.ok(conflict);
  if (conflict.status === 409) assert.equal(conflict.current.codeVersion, 2);
});

test("viewers and non-Team users cannot edit or subscribe without entitlement", () => {
  assert.equal(canEditTeamProject(teamUser, { role: "viewer" }), false);
  assert.equal(
    canAccessTeamProject({ role: "student", subscriptionActive: true, subscriptionTier: "individual" }, membership),
    false,
  );
});
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
  getTeamEntitlementCheckTelemetry,
  recordTeamEntitlementCheck,
  teamEntitlementDurationBucket,
} from "../src/lib/logger.ts";
import {
  nextEntitlementCheckDelay,
  parsePubSubEvent,
  teamAccessRevocationReason,
  teamRoomFullHttpResponse,
} from "../src/lib/team-realtime.ts";
import {
  mergeTeamMessages,
  parseTeamLiveEvent,
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

test("Team room capacity rejects excess sockets and reopens after disconnect or revocation", () => {
  const hub = createTeamRealtimeHub(2);
  const first = trackedSocket();
  const second = trackedSocket();
  const excess = trackedSocket();

  const removeFirst = hub.addSubscriber(12, 101, first.socket);
  assert.ok(removeFirst);
  assert.ok(hub.addSubscriber(12, 102, second.socket));
  assert.equal(hub.subscriberCount(12), 2);
  assert.equal(hub.hasCapacity(12), false);
  assert.equal(hub.addSubscriber(12, 103, excess.socket), null);
  assert.equal(excess.closes.length, 0);

  removeFirst();
  assert.equal(hub.hasCapacity(12), true);
  assert.ok(hub.addSubscriber(12, 103, excess.socket));
  assert.equal(hub.subscriberCount(12), 2);

  hub.revokeAccess(102, 12, "TEAM_MEMBERSHIP_REMOVED");
  assert.deepEqual(second.closes, [{ code: 4403, reason: "TEAM_MEMBERSHIP_REMOVED" }]);
  assert.equal(hub.hasCapacity(12), true);
  const reconnected = trackedSocket();
  assert.ok(hub.addSubscriber(12, 104, reconnected.socket));
  assert.equal(hub.subscriberCount(12), 2);
});

test("full Team rooms return a clear retryable WebSocket upgrade response", () => {
  const response = teamRoomFullHttpResponse();
  assert.match(response, /^HTTP\/1\.1 503 Service Unavailable\r\n/);
  assert.match(response, /\r\nRetry-After: 15\r\n/);
  const [headers, body] = response.split("\r\n\r\n");
  assert.equal(body, "Team room is full. Retry in a few seconds.\n");
  assert.match(headers ?? "", new RegExp(`Content-Length: ${Buffer.byteLength(body ?? "")}`));
  assert.equal(response.includes("authorization"), false);
  assert.equal(response.includes("token"), false);
  assert.equal(response.includes("user"), false);
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

test("entitlement timing uses bounded buckets and warns only after sustained latency", () => {
  assert.equal(teamEntitlementDurationBucket(1), "under_10_ms");
  assert.equal(teamEntitlementDurationBucket(10), "10_to_49_ms");
  assert.equal(teamEntitlementDurationBucket(50), "50_to_199_ms");
  assert.equal(teamEntitlementDurationBucket(200), "200_ms_or_more");

  const before = getTeamEntitlementCheckTelemetry().periodic;
  const first = recordTeamEntitlementCheck({
    source: "periodic",
    durationMs: 250,
    memberCount: 500,
  });
  const second = recordTeamEntitlementCheck({
    source: "periodic",
    durationMs: 300,
    memberCount: 500,
  });
  const third = recordTeamEntitlementCheck({
    source: "periodic",
    durationMs: 400,
    memberCount: 500,
  });
  const after = getTeamEntitlementCheckTelemetry().periodic;

  assert.equal(first.sustainedSlowdown, false);
  assert.equal(second.sustainedSlowdown, false);
  assert.equal(third.sustainedSlowdown, true);
  assert.equal(after.checkedProjects, before.checkedProjects + 3);
  assert.equal(after.checkedMembers, before.checkedMembers + 1_500);
  assert.equal(
    after.durationBuckets["200_ms_or_more"],
    before.durationBuckets["200_ms_or_more"] + 3,
  );
  recordTeamEntitlementCheck({ source: "periodic", durationMs: 5, memberCount: 1 });
  assert.equal(getTeamEntitlementCheckTelemetry().periodic.consecutiveSlowChecks, 0);
});

test("reconnect rehydration and live delivery do not duplicate persisted messages", () => {
  const merged = mergeTeamMessages(
    mergeTeamMessages([message(1)], [message(1), message(2)]),
    [message(2), message(3)],
  );
  assert.deepEqual(merged.map((item) => item.id), [1, 2, 3]);
});

test("malformed live updates are ignored and later valid updates still apply", () => {
  const payloads = [
    "{not-json",
    JSON.stringify({ type: "unknown", projectId: 12 }),
    JSON.stringify({ type: "message.created", projectId: 12, message: { id: 2 } }),
    JSON.stringify({
      type: "code.updated",
      projectId: 12,
      code: { sharedCode: 42, codeLanguage: "TypeScript", codeVersion: 2, updatedAt: "now" },
    }),
    JSON.stringify({ type: "message.created", projectId: 13, message: message(2) }),
    JSON.stringify({ type: "message.created", projectId: 12, message: message(2) }),
    JSON.stringify({
      type: "code.updated",
      projectId: 12,
      code: {
        sharedCode: "const safe = true;",
        codeLanguage: "TypeScript",
        codeVersion: 2,
        updatedAt: "2026-09-08T00:00:02.000Z",
      },
    }),
  ];
  let messages: TeamMessage[] = [];
  let code = "";
  for (const payload of payloads) {
    const event = parseTeamLiveEvent(payload, 12);
    if (event?.type === "message.created") {
      messages = mergeTeamMessages(messages, [event.message]);
    }
    if (event?.type === "code.updated") code = event.code.sharedCode;
  }

  assert.deepEqual(messages.map((item) => item.id), [2]);
  assert.equal(code, "const safe = true;");
  assert.deepEqual(parseTeamLiveEvent(JSON.stringify({ type: "ready", projectId: 12 }), 12), {
    type: "ready",
    projectId: 12,
  });
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
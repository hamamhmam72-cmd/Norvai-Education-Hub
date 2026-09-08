import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  teamMessagesTable,
  teamProjectMembersTable,
  teamProjectsTable,
  usersTable,
} from "@workspace/db/schema";
import { verifyToken } from "./jwt.js";
import {
  getTeamRealtimeTelemetry,
  logger,
  recordTeamRealtimeTelemetry,
} from "./logger.js";
import { canAccessTeamProject } from "./team-collaboration.js";
import { createTeamRealtimeHub, type TeamEvent } from "./team-realtime-hub.js";

export { createTeamRealtimeHub, type TeamEvent } from "./team-realtime-hub.js";

type TeamMessagePayload = {
  id: number;
  [key: string]: unknown;
};

type TeamPubSubEvent =
  | { type: "message.created"; projectId: number; messageId: number }
  | { type: "code.updated"; projectId: number }
  | { type: "access.revoked"; userId: number; projectId?: number };

const TEAM_EVENTS_CHANNEL = "norv_team_events";
const reconnectDelayMs = 5_000;
const entitlementCheckIntervalMs = 15_000;
let pubSubClient: PoolClient | null = null;

let releasePubSubClient: (() => void) | null = null;
let pubSubConnectPromise: Promise<void> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let realtimeClosed = false;
let pubSubConnectionAttempted = false;
const realtimeHub = createTeamRealtimeHub();

type PoolClient = {
  query(sql: string, values?: unknown[]): Promise<unknown>;
  on(event: "notification", listener: (notification: { channel?: string; payload?: string }) => void): PoolClient;
  once(event: "error", listener: (error: Error) => void): PoolClient;
  once(event: "end", listener: () => void): PoolClient;
  release(destroy?: boolean): void;
};

async function emitToLocalSubscribers(event: TeamEvent) {
  const userIds = realtimeHub.subscriberUserIds(event.projectId);
  if (userIds.length === 0) return;
  try {
    const entitlements = await db.select({
      userId: usersTable.id,
      role: usersTable.role,
      subscriptionActive: usersTable.subscriptionActive,
      subscriptionTier: usersTable.subscriptionTier,
      subscriptionExpiry: usersTable.subscriptionExpiry,
      membershipId: teamProjectMembersTable.id,
    }).from(usersTable)
      .leftJoin(teamProjectMembersTable, and(
        eq(teamProjectMembersTable.userId, usersTable.id),
        eq(teamProjectMembersTable.projectId, event.projectId),
      ))
      .where(inArray(usersTable.id, userIds));
    const authorized = new Set<number>();
    for (const entitlement of entitlements) {
      if (canAccessTeamProject(entitlement, entitlement.membershipId ? { id: entitlement.membershipId } : null)) {
        authorized.add(entitlement.userId);
      }
    }
    for (const userId of userIds) {
      if (!authorized.has(userId)) realtimeHub.revokeAccess(userId, event.projectId);
    }
    realtimeHub.broadcast(event);
  } catch (error) {
    logger.error({ err: error, projectId: event.projectId }, "Team broadcast authorization check failed");
  }
}

function toPubSubEvent(event: TeamEvent): TeamPubSubEvent {
  if (event.type === "code.updated") {
    return { type: event.type, projectId: event.projectId };
  }
  return {
    type: event.type,
    projectId: event.projectId,
    messageId: (event.message as TeamMessagePayload).id,
  };
}

function parsePubSubEvent(payload: string): TeamPubSubEvent | null {
  try {
    const value: unknown = JSON.parse(payload);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.type === "access.revoked") {
      const userId = candidate.userId;
      const projectId = candidate.projectId;
      if (typeof userId !== "number" || !Number.isInteger(userId) || userId <= 0) return null;
      if (projectId !== undefined && (
        typeof projectId !== "number" || !Number.isInteger(projectId) || projectId <= 0
      )) return null;
      return { type: candidate.type, userId, projectId: projectId as number | undefined };
    }
    const projectId = candidate.projectId;
    if (typeof projectId !== "number" || !Number.isInteger(projectId) || projectId <= 0) return null;
    if (candidate.type === "code.updated") {
      return { type: candidate.type, projectId };
    }
    if (candidate.type === "message.created" && Number.isInteger(candidate.messageId)) {
      return {
        type: candidate.type,
        projectId,
        messageId: candidate.messageId as number,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function hydratePubSubEvent(
  event: Exclude<TeamPubSubEvent, { type: "access.revoked" }>,
): Promise<TeamEvent | null> {
  if (event.type === "code.updated") {
    const [project] = await db.select({
      id: teamProjectsTable.id,
      sharedCode: teamProjectsTable.sharedCode,
      codeLanguage: teamProjectsTable.codeLanguage,
      codeVersion: teamProjectsTable.codeVersion,
      updatedAt: teamProjectsTable.updatedAt,
    }).from(teamProjectsTable).where(eq(teamProjectsTable.id, event.projectId)).limit(1);
    return project ? { type: event.type, projectId: event.projectId, code: project } : null;
  }

  const [message] = await db.select({
    id: teamMessagesTable.id,
    content: teamMessagesTable.content,
    imageUrl: teamMessagesTable.imageUrl,
    createdAt: teamMessagesTable.createdAt,
    userId: teamMessagesTable.userId,
    username: usersTable.username,
    fullName: usersTable.fullName,
  }).from(teamMessagesTable)
    .innerJoin(usersTable, eq(usersTable.id, teamMessagesTable.userId))
    .where(and(
      eq(teamMessagesTable.id, event.messageId),
      eq(teamMessagesTable.projectId, event.projectId),
    )).limit(1);
  return message ? { type: event.type, projectId: event.projectId, message } : null;
}

async function handlePubSubNotification(payload: string) {
  const event = parsePubSubEvent(payload);
  if (!event) {
    logger.warn("Ignoring malformed team realtime notification");
    return;
  }
  if (event.type === "access.revoked") {
    realtimeHub.revokeAccess(event.userId, event.projectId);
    return;
  }
  try {
    const hydrated = await hydratePubSubEvent(event);
    if (hydrated) await emitToLocalSubscribers(hydrated);
  } catch (error) {
    recordTeamRealtimeTelemetry("hydration_failures");
    logger.error({ err: error, projectId: event.projectId }, "Failed to hydrate team realtime notification");
  }
}

function schedulePubSubReconnect() {
  if (realtimeClosed || reconnectTimer || pubSubConnectPromise) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectPubSub();
  }, reconnectDelayMs);
}

async function connectPubSub() {
  if (realtimeClosed || pubSubClient || pubSubConnectPromise) return;
  if (pubSubConnectionAttempted) {
    recordTeamRealtimeTelemetry("reconnect_attempts");
  }
  pubSubConnectionAttempted = true;
  pubSubConnectPromise = (async () => {
    let client: PoolClient | null = null;
    try {
      client = await pool.connect() as PoolClient;
      await client.query(`LISTEN ${TEAM_EVENTS_CHANNEL}`);
      pubSubClient = client;
      let clientReleased = false;
      const releaseClient = () => {
        if (clientReleased) return;
        clientReleased = true;
        client?.release(true);
      };
      releasePubSubClient = releaseClient;
      client.on("notification", (notification: { channel?: string; payload?: string }) => {
        if (notification.channel === TEAM_EVENTS_CHANNEL && notification.payload) {
          void handlePubSubNotification(notification.payload);
        }
      });
      let disconnected = false;
      const handleDisconnect = (error?: Error) => {
        if (disconnected) return;
        disconnected = true;
        if (pubSubClient === client) pubSubClient = null;
        if (releasePubSubClient === releaseClient) releasePubSubClient = null;
        releaseClient();
        if (error) logger.error({ err: error }, "Team realtime pub/sub connection lost");
        else logger.warn("Team realtime pub/sub connection ended");
        schedulePubSubReconnect();
      };
      client.once("error", (error: Error) => handleDisconnect(error));
      client.once("end", () => handleDisconnect());
      logger.info({ channel: TEAM_EVENTS_CHANNEL }, "Team realtime pub/sub connected");
    } catch (error) {
      client?.release(true);
      logger.error({ err: error }, "Team realtime pub/sub connection failed");
      schedulePubSubReconnect();
    }
  })().finally(() => {
    pubSubConnectPromise = null;
    if (!pubSubClient && !realtimeClosed) schedulePubSubReconnect();
  });
  await pubSubConnectPromise;
}

export function broadcastTeamEvent(event: TeamEvent) {
  const payload = JSON.stringify(toPubSubEvent(event));
  if (!pubSubClient) {
    void emitToLocalSubscribers(event);
    recordTeamRealtimeTelemetry("publish_failures");
    logger.warn("Team realtime pub/sub is not ready; event was delivered locally only");
    void connectPubSub();
    return;
  }
  void pubSubClient.query("SELECT pg_notify($1, $2)", [TEAM_EVENTS_CHANNEL, payload]).catch((error: unknown) => {
    recordTeamRealtimeTelemetry("publish_failures");
    logger.error({ err: error, projectId: event.projectId }, "Failed to publish team realtime event");
    void emitToLocalSubscribers(event);
  });
}

export function revokeTeamRealtimeAccess(userId: number, projectId?: number) {
  const event: TeamPubSubEvent = { type: "access.revoked", userId, projectId };
  const payload = JSON.stringify(event);
  if (!pubSubClient) {
    realtimeHub.revokeAccess(userId, projectId);
    recordTeamRealtimeTelemetry("publish_failures");
    logger.warn({ userId, projectId }, "Team access revocation delivered locally only");
    void connectPubSub();
    return;
  }
  void pubSubClient.query("SELECT pg_notify($1, $2)", [TEAM_EVENTS_CHANNEL, payload]).catch((error: unknown) => {
    recordTeamRealtimeTelemetry("publish_failures");
    logger.error({ err: error, userId, projectId }, "Failed to publish team access revocation");
    realtimeHub.revokeAccess(userId, projectId);
  });
}

export type TeamRealtimeHealth = {
  websocket: "healthy";
  pubSubListener: "connected" | "disconnected";
  reconnectAttempts: number;
  publishFailures: number;
  hydrationFailures: number;
};

export function getTeamRealtimeHealth(): TeamRealtimeHealth {
  const telemetry = getTeamRealtimeTelemetry();
  return {
    websocket: "healthy",
    pubSubListener: pubSubClient ? "connected" : "disconnected",
    reconnectAttempts: telemetry.reconnect_attempts,
    publishFailures: telemetry.publish_failures,
    hydrationFailures: telemetry.hydration_failures,
  };
}

export function attachTeamRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  realtimeClosed = false;
  void connectPubSub();

  server.on("upgrade", async (request, socket, head) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname !== "/api/team/live") {
        socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      const protocols = String(request.headers["sec-websocket-protocol"] ?? "")
        .split(",").map((value) => value.trim());
      const token = protocols[0] === "norv-team" ? protocols[1] : null;
      if (!token) throw new Error("Missing token");
      const identity = verifyToken(token);
      const projectId = Number(url.searchParams.get("projectId"));
      if (!Number.isInteger(projectId)) throw new Error("Invalid project");
      const [user] = await db.select({
        role: usersTable.role,
        subscriptionActive: usersTable.subscriptionActive,
        subscriptionTier: usersTable.subscriptionTier,
        subscriptionExpiry: usersTable.subscriptionExpiry,
      }).from(usersTable).where(eq(usersTable.id, identity.userId)).limit(1);
      const [membership] = await db.select({ id: teamProjectMembersTable.id })
        .from(teamProjectMembersTable)
        .where(and(
          eq(teamProjectMembersTable.projectId, projectId),
          eq(teamProjectMembersTable.userId, identity.userId),
        )).limit(1);
      const entitled = canAccessTeamProject(user, membership);
      if (!entitled) throw new Error("Forbidden");

      wss.handleUpgrade(request, socket, head, (ws) => {
        const removeSubscriber = realtimeHub.addSubscriber(projectId, identity.userId, ws);
        let cleanedUp = false;
        let expiryTimer: NodeJS.Timeout | null = null;
        let entitlementTimer: NodeJS.Timeout | null = null;
        let entitlementCheckRunning = false;
        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          if (expiryTimer) clearTimeout(expiryTimer);
          expiryTimer = null;
          if (entitlementTimer) clearInterval(entitlementTimer);
          entitlementTimer = null;
          removeSubscriber();
        };
        ws.on("error", (error) => {
          logger.warn({ err: error, projectId, userId: identity.userId }, "Team realtime client error");
          cleanup();
          ws.terminate();
        });
        ws.once("close", cleanup);
        if (user?.role !== "admin" && user?.subscriptionExpiry) {
          const closeAtExpiry = () => {
            const remainingMs = user.subscriptionExpiry!.getTime() - Date.now();
            if (remainingMs <= 0) {
              removeSubscriber();
              ws.close(4403, "TEAM_ACCESS_REVOKED");
              return;
            }
            expiryTimer = setTimeout(closeAtExpiry, Math.min(remainingMs, 2_147_483_647));
          };
          closeAtExpiry();
        }
        entitlementTimer = setInterval(() => {
          if (cleanedUp || entitlementCheckRunning) return;
          entitlementCheckRunning = true;
          void Promise.all([
            db.select({
              role: usersTable.role,
              subscriptionActive: usersTable.subscriptionActive,
              subscriptionTier: usersTable.subscriptionTier,
              subscriptionExpiry: usersTable.subscriptionExpiry,
            }).from(usersTable).where(eq(usersTable.id, identity.userId)).limit(1),
            db.select({ id: teamProjectMembersTable.id }).from(teamProjectMembersTable)
              .where(and(
                eq(teamProjectMembersTable.projectId, projectId),
                eq(teamProjectMembersTable.userId, identity.userId),
              )).limit(1),
          ]).then(([users, memberships]) => {
            if (!canAccessTeamProject(users[0], memberships[0])) {
              realtimeHub.revokeAccess(identity.userId, projectId);
            }
          }).catch((error) => {
            logger.error(
              { err: error, projectId, userId: identity.userId },
              "Team realtime entitlement recheck failed",
            );
          }).finally(() => {
            entitlementCheckRunning = false;
          });
        }, entitlementCheckIntervalMs);
        ws.send(JSON.stringify({ type: "ready", projectId }));
      });
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("error", (error) => logger.error({ err: error }, "Team realtime server error"));
  server.once("close", () => {
    realtimeClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    const releaseClient = releasePubSubClient;
    releasePubSubClient = null;
    pubSubClient = null;
    releaseClient?.();
  });
}

import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { and, eq } from "drizzle-orm";
import { db, pool, type PoolClient } from "@workspace/db";
import {
  teamMessagesTable,
  teamProjectMembersTable,
  teamProjectsTable,
  usersTable,
} from "@workspace/db/schema";
import { verifyToken } from "./jwt.js";
import { logger } from "./logger.js";

type TeamEvent =
  | { type: "message.created"; projectId: number; message: TeamMessagePayload }
  | { type: "code.updated"; projectId: number; code: TeamCodePayload };

type TeamMessagePayload = {
  id: number;
  [key: string]: unknown;
};

type TeamCodePayload = {
  id: number;
  [key: string]: unknown;
};

type TeamPubSubEvent =
  | { type: "message.created"; projectId: number; messageId: number }
  | { type: "code.updated"; projectId: number };

const subscribers = new Map<number, Set<WebSocket>>();
const TEAM_EVENTS_CHANNEL = "norv_team_events";
const reconnectDelayMs = 5_000;
let pubSubClient: PoolClient | null = null;
let pubSubConnectPromise: Promise<void> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let realtimeClosed = false;

function emitToLocalSubscribers(event: TeamEvent) {
  const payload = JSON.stringify(event);
  for (const socket of subscribers.get(event.projectId) ?? []) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}

function toPubSubEvent(event: TeamEvent): TeamPubSubEvent {
  if (event.type === "code.updated") {
    return { type: event.type, projectId: event.projectId };
  }
  return {
    type: event.type,
    projectId: event.projectId,
    messageId: event.message.id,
  };
}

function parsePubSubEvent(payload: string): TeamPubSubEvent | null {
  try {
    const value: unknown = JSON.parse(payload);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
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

async function hydratePubSubEvent(event: TeamPubSubEvent): Promise<TeamEvent | null> {
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
  try {
    const hydrated = await hydratePubSubEvent(event);
    if (hydrated) emitToLocalSubscribers(hydrated);
  } catch (error) {
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
  pubSubConnectPromise = (async () => {
    let client: PoolClient | null = null;
    try {
      client = await pool.connect();
      await client.query(`LISTEN ${TEAM_EVENTS_CHANNEL}`);
      pubSubClient = client;
      client.on("notification", (notification) => {
        if (notification.channel === TEAM_EVENTS_CHANNEL && notification.payload) {
          void handlePubSubNotification(notification.payload);
        }
      });
      let disconnected = false;
      const handleDisconnect = (error?: Error) => {
        if (disconnected) return;
        disconnected = true;
        if (pubSubClient === client) pubSubClient = null;
        client?.release(true);
        if (error) logger.error({ err: error }, "Team realtime pub/sub connection lost");
        else logger.warn("Team realtime pub/sub connection ended");
        schedulePubSubReconnect();
      };
      client.once("error", (error) => handleDisconnect(error));
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
    emitToLocalSubscribers(event);
    logger.warn("Team realtime pub/sub is not ready; event was delivered locally only");
    void connectPubSub();
    return;
  }
  void pubSubClient.query("SELECT pg_notify($1, $2)", [TEAM_EVENTS_CHANNEL, payload]).catch((error: unknown) => {
    logger.error({ err: error, projectId: event.projectId }, "Failed to publish team realtime event");
    emitToLocalSubscribers(event);
  });
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
      }).from(usersTable).where(eq(usersTable.id, identity.userId)).limit(1);
      const [membership] = await db.select({ id: teamProjectMembersTable.id })
        .from(teamProjectMembersTable)
        .where(and(
          eq(teamProjectMembersTable.projectId, projectId),
          eq(teamProjectMembersTable.userId, identity.userId),
        )).limit(1);
      const entitled = user?.role === "admin"
        || Boolean(user?.subscriptionActive && user.subscriptionTier === "team" && membership);
      if (!entitled) throw new Error("Forbidden");

      wss.handleUpgrade(request, socket, head, (ws) => {
        const projectSubscribers = subscribers.get(projectId) ?? new Set<WebSocket>();
        projectSubscribers.add(ws);
        subscribers.set(projectId, projectSubscribers);
        let cleanedUp = false;
        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          projectSubscribers.delete(ws);
          if (projectSubscribers.size === 0) subscribers.delete(projectId);
        };
        ws.on("error", (error) => {
          logger.warn({ err: error, projectId, userId: identity.userId }, "Team realtime client error");
          cleanup();
          ws.terminate();
        });
        ws.once("close", cleanup);
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
    pubSubClient?.release(true);
    pubSubClient = null;
  });
}
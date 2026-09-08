import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { teamProjectMembersTable, usersTable } from "@workspace/db/schema";
import { verifyToken } from "./jwt.js";
import { logger } from "./logger.js";

type TeamEvent =
  | { type: "message.created"; projectId: number; message: unknown }
  | { type: "code.updated"; projectId: number; code: unknown };

const subscribers = new Map<number, Set<WebSocket>>();

export function broadcastTeamEvent(event: TeamEvent) {
  const payload = JSON.stringify(event);
  for (const socket of subscribers.get(event.projectId) ?? []) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}

export function attachTeamRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

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
}
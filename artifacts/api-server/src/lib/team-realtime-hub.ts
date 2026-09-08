import { WebSocket } from "ws";

export type TeamEvent =
  | { type: "message.created"; projectId: number; message: unknown }
  | { type: "code.updated"; projectId: number; code: unknown };

export function createTeamRealtimeHub() {
  const subscribers = new Map<number, Set<WebSocket>>();

  return {
    addSubscriber(projectId: number, socket: WebSocket) {
      const projectSubscribers = subscribers.get(projectId) ?? new Set<WebSocket>();
      projectSubscribers.add(socket);
      subscribers.set(projectId, projectSubscribers);
      return () => {
        projectSubscribers.delete(socket);
        if (projectSubscribers.size === 0) subscribers.delete(projectId);
      };
    },
    broadcast(event: TeamEvent) {
      const payload = JSON.stringify(event);
      for (const socket of subscribers.get(event.projectId) ?? []) {
        if (socket.readyState === WebSocket.OPEN) socket.send(payload);
      }
    },
    subscriberCount(projectId: number) {
      return subscribers.get(projectId)?.size ?? 0;
    },
  };
}
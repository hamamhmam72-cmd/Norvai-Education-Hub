import { WebSocket } from "ws";

export type TeamEvent =
  | { type: "message.created"; projectId: number; message: unknown }
  | { type: "code.updated"; projectId: number; code: unknown };

export function createTeamRealtimeHub() {
  type Subscriber = { userId: number; socket: WebSocket };
  const subscribers = new Map<number, Set<Subscriber>>();

  return {
    addSubscriber(projectId: number, userId: number, socket: WebSocket) {
      const projectSubscribers = subscribers.get(projectId) ?? new Set<Subscriber>();
      const subscriber = { userId, socket };
      projectSubscribers.add(subscriber);
      subscribers.set(projectId, projectSubscribers);
      return () => {
        projectSubscribers.delete(subscriber);
        if (projectSubscribers.size === 0) subscribers.delete(projectId);
      };
    },
    broadcast(event: TeamEvent) {
      const payload = JSON.stringify(event);
      for (const { socket } of subscribers.get(event.projectId) ?? []) {
        if (socket.readyState === WebSocket.OPEN) socket.send(payload);
      }
    },
    revokeAccess(userId: number, projectId?: number) {
      const projects = projectId === undefined
        ? [...subscribers.entries()]
        : [[projectId, subscribers.get(projectId) ?? new Set<Subscriber>()] as const];
      for (const [currentProjectId, projectSubscribers] of projects) {
        for (const subscriber of [...projectSubscribers]) {
          if (subscriber.userId !== userId) continue;
          projectSubscribers.delete(subscriber);
          if (
            subscriber.socket.readyState === WebSocket.OPEN
            || subscriber.socket.readyState === WebSocket.CONNECTING
          ) {
            subscriber.socket.close(4403, "TEAM_ACCESS_REVOKED");
          }
        }
        if (projectSubscribers.size === 0) subscribers.delete(currentProjectId);
      }
    },
    subscriberUserIds(projectId: number) {
      return [...new Set(
        [...(subscribers.get(projectId) ?? [])].map((subscriber) => subscriber.userId),
      )];
    },
    subscriberCount(projectId: number) {
      return subscribers.get(projectId)?.size ?? 0;
    },
  };
}
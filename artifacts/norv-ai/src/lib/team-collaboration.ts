export interface TeamMessage {
  id: number;
  userId: number;
  username?: string;
  fullName?: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export function shouldReconnectTeamSocket(closeCode: number) {
  return closeCode !== 4403;
}

export function teamAccessRevocationMessage(reason: string) {
  if (reason === "TEAM_MEMBERSHIP_REMOVED") {
    return "You were removed from this Team project. Ask the project owner to add you again.";
  }
  if (reason === "TEAM_PLAN_DOWNGRADED") {
    return "Your account no longer has a Team plan. Switch back to Team to restore live collaboration.";
  }
  if (reason === "TEAM_SUBSCRIPTION_EXPIRED") {
    return "Your Team subscription expired. Renew Team to restore live collaboration.";
  }
  return "Your Team access ended. Reconnect after access is restored.";
}

/**
 * Rehydration and live delivery can contain the same persisted message.
 * IDs are the durable identity, so a later copy replaces an older copy.
 */
export function mergeTeamMessages(
  current: TeamMessage[],
  incoming: TeamMessage[],
) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}
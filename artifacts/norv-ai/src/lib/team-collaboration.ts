export interface TeamMessage {
  id: number;
  userId: number;
  username?: string;
  fullName?: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
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
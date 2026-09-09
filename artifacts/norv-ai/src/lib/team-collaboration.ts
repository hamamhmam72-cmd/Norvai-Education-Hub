export interface TeamMessage {
  id: number;
  userId: number;
  username?: string;
  fullName?: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
}

export interface TeamCodeUpdate {
  sharedCode: string;
  codeLanguage: string;
  codeVersion: number;
  updatedAt: string;
}

export type TeamLiveEvent =
  | { type: "ready"; projectId: number }
  | { type: "message.created"; projectId: number; message: TeamMessage }
  | { type: "code.updated"; projectId: number; code: TeamCodeUpdate };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTeamMessage(value: unknown): value is TeamMessage {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.id)
    && Number(value.id) > 0
    && Number.isInteger(value.userId)
    && Number(value.userId) > 0
    && (value.content === null || typeof value.content === "string")
    && (value.imageUrl === null || typeof value.imageUrl === "string")
    && typeof value.createdAt === "string"
    && (value.username === undefined || typeof value.username === "string")
    && (value.fullName === undefined || typeof value.fullName === "string");
}

function isTeamCodeUpdate(value: unknown): value is TeamCodeUpdate {
  if (!isRecord(value)) return false;
  return typeof value.sharedCode === "string"
    && typeof value.codeLanguage === "string"
    && value.codeLanguage.length > 0
    && Number.isInteger(value.codeVersion)
    && Number(value.codeVersion) >= 0
    && typeof value.updatedAt === "string";
}

export function parseTeamLiveEvent(
  payload: unknown,
  expectedProjectId?: number,
): TeamLiveEvent | null {
  try {
    const value: unknown = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!isRecord(value)) return null;
    const projectId = value.projectId;
    if (!Number.isInteger(projectId) || Number(projectId) <= 0) return null;
    if (expectedProjectId !== undefined && projectId !== expectedProjectId) return null;
    if (value.type === "ready") return { type: value.type, projectId: Number(projectId) };
    if (value.type === "message.created" && isTeamMessage(value.message)) {
      return { type: value.type, projectId: Number(projectId), message: value.message };
    }
    if (value.type === "code.updated" && isTeamCodeUpdate(value.code)) {
      return { type: value.type, projectId: Number(projectId), code: value.code };
    }
    return null;
  } catch {
    return null;
  }
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
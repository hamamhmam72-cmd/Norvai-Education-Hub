export interface TeamUserEntitlement {
  role?: string | null;
  subscriptionActive?: boolean | null;
  subscriptionTier?: string | null;
}

export interface TeamMembership {
  id?: number;
  role?: string | null;
}

export function hasActiveTeamSubscription(user: TeamUserEntitlement | null | undefined) {
  return Boolean(user?.subscriptionActive && user.subscriptionTier === "team");
}

export function canAccessTeamProject(
  user: TeamUserEntitlement | null | undefined,
  membership: TeamMembership | null | undefined,
) {
  return user?.role === "admin" || (hasActiveTeamSubscription(user) && Boolean(membership));
}

export function canEditTeamProject(
  user: TeamUserEntitlement | null | undefined,
  membership: TeamMembership | null | undefined,
) {
  return user?.role === "admin"
    || (canAccessTeamProject(user, membership)
      && (membership?.role === "owner" || membership?.role === "editor"));
}

export interface TeamCodeSnapshot {
  id: number;
  sharedCode: string;
  codeLanguage: string;
  codeVersion: number;
  updatedAt: Date | string;
}

export interface TeamCodeSaveInput {
  projectId: number;
  code: string;
  codeLanguage: string;
  expectedVersion: number;
}

export interface TeamCodeStore {
  updateIfVersion(input: TeamCodeSaveInput): Promise<TeamCodeSnapshot | null>;
  getCurrent(projectId: number): Promise<TeamCodeSnapshot | null>;
}

export type TeamCodeSaveResult =
  | { status: 200; project: TeamCodeSnapshot }
  | { status: 404; error: "Project not found" }
  | { status: 409; error: "Newer shared code is available"; current: TeamCodeSnapshot };

/**
 * Keeps the stale-write decision next to the store contract. The store must
 * make updateIfVersion atomic (the SQL route does this with a version predicate).
 */
export async function saveTeamCodeWithVersion(
  store: TeamCodeStore,
  input: TeamCodeSaveInput,
): Promise<TeamCodeSaveResult> {
  const project = await store.updateIfVersion(input);
  if (project) return { status: 200, project };

  const current = await store.getCurrent(input.projectId);
  if (!current) return { status: 404, error: "Project not found" };
  return { status: 409, error: "Newer shared code is available", current };
}
import type { Team, TeamMember, TeamRole } from "@/server/db/schema";
import type { Plan } from "@/lib/billing/plans";

/**
 * Workspace types
 */
export type WorkspaceType = "personal" | "team";

/**
 * Permission actions available in workspaces
 */
export type WorkspacePermission =
  | "links.create"
  | "links.edit"
  | "links.delete"
  | "folders.create"
  | "folders.edit"
  | "folders.delete"
  | "qrcodes.create"
  | "qrcodes.edit"
  | "qrcodes.delete"
  | "domains.create"
  | "domains.delete"
  | "tags.create"
  | "tags.delete"
  | "utm.create"
  | "utm.edit"
  | "utm.delete"
  | "team.settings"
  | "team.invite"
  | "team.remove_member"
  | "team.delete";

/**
 * Role-based permission mapping
 * Owner: Full access to everything
 * Admin: Can manage resources and invite members, but cannot manage domains or delete team
 * Member: Can create and manage resources, but cannot manage team settings
 */
export const ROLE_PERMISSIONS: Record<TeamRole, WorkspacePermission[]> = {
  owner: [
    "links.create",
    "links.edit",
    "links.delete",
    "folders.create",
    "folders.edit",
    "folders.delete",
    "qrcodes.create",
    "qrcodes.edit",
    "qrcodes.delete",
    "domains.create",
    "domains.delete",
    "tags.create",
    "tags.delete",
    "utm.create",
    "utm.edit",
    "utm.delete",
    "team.settings",
    "team.invite",
    "team.remove_member",
    "team.delete",
  ],
  admin: [
    "links.create",
    "links.edit",
    "links.delete",
    "folders.create",
    "folders.edit",
    "folders.delete",
    "qrcodes.create",
    "qrcodes.edit",
    "qrcodes.delete",
    "tags.create",
    "tags.delete",
    "utm.create",
    "utm.edit",
    "utm.delete",
    "team.settings",
    "team.invite",
    "team.remove_member",
  ],
  member: [
    "links.create",
    "links.edit",
    "links.delete",
    "folders.create",
    "folders.edit",
    "folders.delete",
    "qrcodes.create",
    "qrcodes.edit",
    "qrcodes.delete",
    "tags.create",
    "tags.delete",
    "utm.create",
    "utm.edit",
    "utm.delete",
  ],
};

/**
 * Personal workspace context
 */
export type PersonalWorkspaceContext = {
  type: "personal";
  userId: string;
  teamId: null;
  teamSlug: null;
  role: "owner"; // Users are always owners of their personal workspace
  plan: Plan;
};

/**
 * Team workspace context
 */
export type TeamWorkspaceContext = {
  type: "team";
  userId: string;
  teamId: number;
  teamSlug: string;
  team: Team;
  membership: TeamMember;
  role: TeamRole;
  plan: "ultra"; // Teams are always Ultra (since only Ultra users can create teams)
};

/**
 * Union type for any workspace context
 */
export type WorkspaceContext = PersonalWorkspaceContext | TeamWorkspaceContext;

/**
 * Type guard to check if workspace is a team workspace
 */
export function isTeamWorkspace(
  workspace: WorkspaceContext
): workspace is TeamWorkspaceContext {
  return workspace.type === "team";
}

/**
 * Type guard to check if workspace is a personal workspace
 */
export function isPersonalWorkspace(
  workspace: WorkspaceContext
): workspace is PersonalWorkspaceContext {
  return workspace.type === "personal";
}

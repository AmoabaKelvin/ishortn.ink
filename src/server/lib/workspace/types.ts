import type { Plan } from "@/lib/billing/plans";
import type { Team, TeamMember, TeamRole } from "@/server/db/schema";

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
  | "bio.create"
  | "bio.edit"
  | "bio.delete"
  | "campaigns.create"
  | "campaigns.edit"
  | "campaigns.delete"
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
export const ROLE_PERMISSIONS = {
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
    "bio.create",
    "bio.edit",
    "bio.delete",
    "campaigns.create",
    "campaigns.edit",
    "campaigns.delete",
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
    "bio.create",
    "bio.edit",
    "bio.delete",
    "campaigns.create",
    "campaigns.edit",
    "campaigns.delete",
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
    "bio.create",
    "bio.edit",
    "bio.delete",
    "campaigns.create",
    "campaigns.edit",
    "campaigns.delete",
  ],
} satisfies Record<TeamRole, WorkspacePermission[]>;

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
  // Plan that existing usage is held to during an over-plan grace (see
  // graceUsagePlan in src/lib/billing/entitlements.ts); absent means `plan`.
  graceUsagePlan?: Plan;
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
  // From the owner's live plan (see teamAccess in src/lib/billing/entitlements.ts).
  plan: Plan;
  // Owner not on Ultra past the grace period: every write is refused.
  readOnly: boolean;
  ownerGraceEndsAt: Date | null;
};

/**
 * Union type for any workspace context
 */
export type WorkspaceContext = PersonalWorkspaceContext | TeamWorkspaceContext;

/**
 * Type guard to check if workspace is a team workspace
 */
export function isTeamWorkspace(workspace: WorkspaceContext): workspace is TeamWorkspaceContext {
  return workspace.type === "team";
}

/**
 * Type guard to check if workspace is a personal workspace
 */
export function isPersonalWorkspace(
  workspace: WorkspaceContext,
): workspace is PersonalWorkspaceContext {
  return workspace.type === "personal";
}

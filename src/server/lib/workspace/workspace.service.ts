import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

import { effectivePlan, graceUsagePlan, paidPlan, teamAccess } from "@/lib/billing/entitlements";
import { extractPlatformSubdomain } from "@/lib/constants/domains";
import { db } from "@/server/db";
import { RESERVED_TEAM_SLUGS, team, teamMember } from "@/server/db/schema";
import { ensurePlanChecked } from "@/server/lib/entitlements/grace";

import type { WorkspaceContext, PersonalWorkspaceContext, TeamWorkspaceContext } from "./types";
import type { TeamAccess } from "@/lib/billing/entitlements";
import type { Plan } from "@/lib/billing/plans";
import type { Team, TeamRole } from "@/server/db/schema";

type DbClient = typeof db;

/**
 * Extracts the subdomain from a hostname.
 *
 * Any platform domain is accepted, so `acme.isht.app`, `acme.isht.ink` and
 * `acme.ishortn.ink` all resolve to team slug `acme`.
 *
 * Examples:
 * - "acme.isht.app" -> "acme"
 * - "acme.isht.ink" -> "acme"
 * - "acme.ishortn.ink" -> "acme"
 * - "isht.ink" -> null
 * - "localhost:3000" -> null
 * - "acme.localhost:3000" -> "acme" (for local development)
 *
 * @param hostname - The full hostname from the request
 * @returns The subdomain or null if no subdomain
 */
export function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(":")[0] ?? hostname;

  let subdomain: string | null = extractPlatformSubdomain(host);

  // Check for local development subdomains (*.localhost)
  if (!subdomain && host.endsWith(".localhost")) {
    const parts = host.split(".");
    if (parts.length === 2) {
      const candidate = parts[0]?.trim().toLowerCase();
      if (candidate && candidate.length > 0) {
        subdomain = candidate;
      }
    }
  }

  // Don't treat reserved slugs as team subdomains
  // These are system subdomains (www, api, app, etc.) that should use personal workspace
  if (subdomain && RESERVED_TEAM_SLUGS.includes(subdomain)) {
    return null;
  }

  return subdomain;
}

/**
 * Resolves the workspace context for the current request.
 *
 * @param userId - The authenticated user's ID
 * @param hostname - The request hostname
 * @param dbClient - Optional database client (defaults to main db)
 * @returns The resolved workspace context
 */
export async function resolveWorkspaceContext(
  userId: string,
  hostname: string,
  dbClient: DbClient = db,
): Promise<WorkspaceContext> {
  const subdomain = extractSubdomain(hostname);

  if (!subdomain) {
    // No subdomain -> personal workspace
    return getPersonalWorkspaceContext(userId, dbClient);
  }

  // Subdomain exists -> try to resolve team workspace
  return getTeamWorkspaceContext(userId, subdomain, dbClient);
}

/**
 * Gets the personal workspace context for a user.
 */
async function getPersonalWorkspaceContext(
  userId: string,
  dbClient: DbClient,
): Promise<PersonalWorkspaceContext> {
  // Fetch user with subscription to determine plan
  const userRecord = await dbClient.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, userId),
    with: {
      subscriptions: true,
    },
  });

  if (!userRecord) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  const sub = userRecord.subscriptions ?? null;
  const grace = await ensurePlanChecked(userRecord, sub);

  return {
    type: "personal",
    userId,
    teamId: null,
    teamSlug: null,
    role: "owner",
    plan: effectivePlan(sub, grace),
    graceUsagePlan: graceUsagePlan(sub, grace),
  };
}

/**
 * Gets the team workspace context for a user by team slug.
 */
async function getTeamWorkspaceContext(
  userId: string,
  teamSlug: string,
  dbClient: DbClient,
): Promise<TeamWorkspaceContext> {
  // Fetch team by slug (exclude soft-deleted teams)
  const teamRecord = await dbClient.query.team.findFirst({
    where: and(eq(team.slug, teamSlug), isNull(team.deletedAt)),
  });

  if (!teamRecord) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Team not found",
    });
  }

  // Check if user is a member of this team; the owner's plan is read alongside.
  const [membership, access] = await Promise.all([
    dbClient.query.teamMember.findFirst({
      where: and(eq(teamMember.teamId, teamRecord.id), eq(teamMember.userId, userId)),
    }),
    getTeamAccess(teamRecord, dbClient),
  ]);

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this team",
    });
  }

  return {
    type: "team",
    userId,
    teamId: teamRecord.id,
    teamSlug: teamRecord.slug,
    team: teamRecord,
    membership,
    role: membership.role,
    plan: access.plan,
    readOnly: access.readOnly,
    ownerGraceEndsAt: access.graceEndsAt,
  };
}

/**
 * Gets the team workspace context by team ID (for internal use).
 */
export async function getTeamWorkspaceContextById(
  userId: string,
  teamId: number,
  dbClient: DbClient = db,
): Promise<TeamWorkspaceContext> {
  // Fetch team by ID (exclude soft-deleted teams)
  const teamRecord = await dbClient.query.team.findFirst({
    where: and(eq(team.id, teamId), isNull(team.deletedAt)),
  });

  if (!teamRecord) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Team not found",
    });
  }

  // Check if user is a member of this team; the owner's plan is read alongside.
  const [membership, access] = await Promise.all([
    dbClient.query.teamMember.findFirst({
      where: and(eq(teamMember.teamId, teamRecord.id), eq(teamMember.userId, userId)),
    }),
    getTeamAccess(teamRecord, dbClient),
  ]);

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this team",
    });
  }

  return {
    type: "team",
    userId,
    teamId: teamRecord.id,
    teamSlug: teamRecord.slug,
    team: teamRecord,
    membership,
    role: membership.role,
    plan: access.plan,
    readOnly: access.readOnly,
    ownerGraceEndsAt: access.graceEndsAt,
  };
}

/** The effective plan of an account (paid plan, or its grace plan while that lasts). */
export async function getUserEffectivePlan(userId: string, dbClient: DbClient = db): Promise<Plan> {
  const userRecord = await dbClient.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, userId),
    columns: { planGracePlan: true, planGraceEndsAt: true, planGraceReason: true },
    with: {
      subscriptions: true,
    },
  });

  if (!userRecord) return "free";
  return effectivePlan(userRecord.subscriptions ?? null, userRecord);
}

/**
 * Whether a user is paying for Ultra right now. Required for team creation and
 * for taking over a team. A grace period doesn't count: it keeps existing usage
 * working, it doesn't unlock new teams.
 */
export async function userHasUltraPlan(userId: string, dbClient: DbClient = db): Promise<boolean> {
  const sub = await dbClient.query.subscription.findFirst({
    where: (table, { eq }) => eq(table.userId, userId),
  });
  return paidPlan(sub ?? null) === "ultra";
}

/** A team's entitlements, from its owner's live plan and the team grace period. */
export async function getTeamAccess(
  teamRecord: Pick<Team, "ownerId" | "ownerPlanGraceEndsAt">,
  dbClient: DbClient = db,
): Promise<TeamAccess> {
  const ownerPlan = await getUserEffectivePlan(teamRecord.ownerId, dbClient);
  return teamAccess(ownerPlan, teamRecord.ownerPlanGraceEndsAt);
}

/**
 * Gets all teams that a user is a member of (excludes soft-deleted teams).
 */
export async function getUserTeams(
  userId: string,
  dbClient: DbClient = db,
): Promise<Array<{ team: typeof team.$inferSelect; role: TeamRole }>> {
  const memberships = await dbClient.query.teamMember.findMany({
    where: eq(teamMember.userId, userId),
    with: {
      team: true,
    },
  });

  // Filter out soft-deleted teams
  return memberships
    .filter((m) => m.team.deletedAt === null)
    .map((m) => ({
      team: m.team,
      role: m.role,
    }));
}

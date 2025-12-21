import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

import { resolvePlan } from "@/lib/billing/plans";
import { db } from "@/server/db";
import { team, teamMember } from "@/server/db/schema";

import type { WorkspaceContext, PersonalWorkspaceContext, TeamWorkspaceContext } from "./types";

type DbClient = typeof db;

/**
 * Extracts the subdomain from a hostname.
 *
 * Examples:
 * - "acme.ishortn.ink" -> "acme"
 * - "ishortn.ink" -> null
 * - "localhost:3000" -> null
 * - "acme.localhost:3000" -> "acme" (for local development)
 *
 * @param hostname - The full hostname from the request
 * @returns The subdomain or null if no subdomain
 */
export function extractSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(":")[0] ?? hostname;

  // Check for production subdomains (*.ishortn.ink)
  if (host.endsWith(".ishortn.ink")) {
    const parts = host.split(".");
    if (parts.length === 3) {
      const subdomain = parts[0]?.trim();
      if (subdomain && subdomain.length > 0) {
        return subdomain;
      }
      return null;
    }
  }

  // Check for local development subdomains (*.localhost)
  if (host.endsWith(".localhost")) {
    const parts = host.split(".");
    if (parts.length === 2) {
      const subdomain = parts[0]?.trim();
      if (subdomain && subdomain.length > 0) {
        return subdomain;
      }
      return null;
    }
  }

  return null;
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
  dbClient: DbClient = db
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
  dbClient: DbClient
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

  const plan = resolvePlan(userRecord.subscriptions ?? null);

  return {
    type: "personal",
    userId,
    teamId: null,
    teamSlug: null,
    role: "owner",
    plan,
  };
}

/**
 * Gets the team workspace context for a user by team slug.
 */
async function getTeamWorkspaceContext(
  userId: string,
  teamSlug: string,
  dbClient: DbClient
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

  // Check if user is a member of this team
  const membership = await dbClient.query.teamMember.findFirst({
    where: and(
      eq(teamMember.teamId, teamRecord.id),
      eq(teamMember.userId, userId)
    ),
  });

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
    plan: "ultra", // Teams always have Ultra features
  };
}

/**
 * Gets the team workspace context by team ID (for internal use).
 */
export async function getTeamWorkspaceContextById(
  userId: string,
  teamId: number,
  dbClient: DbClient = db
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

  // Check if user is a member of this team
  const membership = await dbClient.query.teamMember.findFirst({
    where: and(
      eq(teamMember.teamId, teamRecord.id),
      eq(teamMember.userId, userId)
    ),
  });

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
    plan: "ultra",
  };
}

/**
 * Checks if a user has an Ultra plan subscription.
 * Required for team creation.
 */
export async function userHasUltraPlan(
  userId: string,
  dbClient: DbClient = db
): Promise<boolean> {
  const userRecord = await dbClient.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, userId),
    with: {
      subscriptions: true,
    },
  });

  if (!userRecord) {
    return false;
  }

  const plan = resolvePlan(userRecord.subscriptions ?? null);
  return plan === "ultra";
}

/**
 * Gets all teams that a user is a member of (excludes soft-deleted teams).
 */
export async function getUserTeams(
  userId: string,
  dbClient: DbClient = db
): Promise<Array<{ team: typeof team.$inferSelect; role: string }>> {
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

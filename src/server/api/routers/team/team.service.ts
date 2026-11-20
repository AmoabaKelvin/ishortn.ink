import crypto from "node:crypto";

import { TRPCError } from "@trpc/server";
import { addDays, subDays } from "date-fns";
import { and, count, eq, gt, gte, isNotNull, isNull, sql } from "drizzle-orm";

import { TEAM_READ_ONLY_MESSAGE } from "@/lib/billing/entitlements";
import { getAppBaseDomain, isPlatformDomain } from "@/lib/constants/domains";
import { deleteFromCache } from "@/lib/core/cache";
import { runBackgroundTask } from "@/lib/utils/background";
import {
  customDomain,
  RESERVED_TEAM_SLUGS,
  team,
  teamInvite,
  teamMember,
  user,
} from "@/server/db/schema";
import { sendTeamInviteEmail } from "@/server/lib/notifications/team-invite";
import { requireMinimumRole, requirePermission } from "@/server/lib/workspace/permissions";
import { getTeamAccess, userHasUltraPlan } from "@/server/lib/workspace/workspace.service";

import {
  DAILY_INVITE_EMAIL_LIMIT,
  inviteEmailMatches,
  inviteStatus,
  inviteView,
  memberRoleChangeError,
  normalizeInviteEmail,
} from "./utils";

import type { ProtectedTRPCContext, TeamTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type {
  AcceptInviteInput,
  CreateTeamInput,
  DeclineInviteInput,
  InviteMemberInput,
  RemoveMemberInput,
  RevokeInviteInput,
  TransferOwnershipInput,
  UpdateMemberRoleInput,
  UpdateTeamInput,
  UpdateTeamSlugInput,
} from "./team.input";

// ============================================================================
// TEAM CRUD
// ============================================================================

/**
 * Create a new team (requires Ultra plan - enforced by procedure)
 */
export async function createTeam(ctx: ProtectedTRPCContext, input: CreateTeamInput) {
  // Normalize and validate slug
  const normalizedSlug = input.slug.trim().toLowerCase();

  // Defense-in-depth: Check reserved slugs (also validated in Zod schema)
  if (RESERVED_TEAM_SLUGS.includes(normalizedSlug)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This team slug is reserved and cannot be used",
    });
  }

  // Check if slug is already taken (exclude soft-deleted teams)
  const existingTeam = await ctx.db.query.team.findFirst({
    where: and(eq(team.slug, normalizedSlug), isNull(team.deletedAt)),
  });

  if (existingTeam) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This team slug is already taken",
    });
  }

  // Create team in transaction
  const result = await ctx.db.transaction(async (tx) => {
    // Create the team with normalized slug
    const [teamResult] = await tx.insert(team).values({
      name: input.name,
      slug: normalizedSlug,
      ownerId: ctx.auth.userId,
    });

    const teamId = Number(teamResult.insertId);

    // Add owner as team member
    await tx.insert(teamMember).values({
      teamId,
      userId: ctx.auth.userId,
      role: "owner",
    });

    return { teamId, slug: normalizedSlug };
  });

  return result;
}

/**
 * Get current team details (from workspace context)
 */
export async function getTeam(ctx: TeamTRPCContext) {
  return ctx.workspace.team;
}

/**
 * Update team settings
 */
export async function updateTeam(ctx: TeamTRPCContext, input: UpdateTeamInput) {
  requirePermission(ctx.workspace, "team.settings", "update team settings");

  if (input.defaultDomain && !isPlatformDomain(input.defaultDomain)) {
    const validDomain = await ctx.db.query.customDomain.findFirst({
      where: and(
        eq(customDomain.domain, input.defaultDomain),
        eq(customDomain.teamId, ctx.workspace.teamId),
        eq(customDomain.status, "active"),
      ),
    });

    if (!validDomain) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Invalid domain. Only verified custom domains belonging to this team can be set as default.",
      });
    }
  }

  await ctx.db
    .update(team)
    .set({
      name: input.name,
      avatarUrl: input.avatarUrl,
      defaultDomain: input.defaultDomain,
    })
    .where(eq(team.id, ctx.workspace.teamId));

  // Invalidate the team default domain cache
  await deleteFromCache(`team_default_domain:${ctx.workspace.teamId}`);

  // Fetch and return updated team
  const updatedTeam = await ctx.db.query.team.findFirst({
    where: eq(team.id, ctx.workspace.teamId),
  });

  return updatedTeam;
}

/**
 * Update team slug (subdomain)
 */
export async function updateTeamSlug(ctx: TeamTRPCContext, input: UpdateTeamSlugInput) {
  requireMinimumRole(ctx.workspace, "owner", "change team slug");

  // Normalize and validate slug
  const normalizedSlug = input.slug.trim().toLowerCase();

  // Defense-in-depth: Check reserved slugs (also validated in Zod schema)
  if (RESERVED_TEAM_SLUGS.includes(normalizedSlug)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This team slug is reserved and cannot be used",
    });
  }

  // Check if new slug is already taken (exclude soft-deleted teams)
  const existingTeam = await ctx.db.query.team.findFirst({
    where: and(eq(team.slug, normalizedSlug), isNull(team.deletedAt)),
  });

  if (existingTeam && existingTeam.id !== ctx.workspace.teamId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This team slug is already taken",
    });
  }

  await ctx.db.update(team).set({ slug: normalizedSlug }).where(eq(team.id, ctx.workspace.teamId));

  return { slug: normalizedSlug };
}

/**
 * Delete team (owner only)
 * Members lose access immediately and there is no restore. The team row is only
 * soft-deleted so the cleanup cron can purge its resources in batches later
 * (team-cleanup.service.ts).
 */
export async function deleteTeam(ctx: TeamTRPCContext) {
  requirePermission(ctx.workspace, "team.delete", "delete team");

  await ctx.db.transaction(async (tx) => {
    // Delete all pending invites (no need to preserve these)
    await tx.delete(teamInvite).where(eq(teamInvite.teamId, ctx.workspace.teamId));

    // Remove all members (they can no longer access the team)
    await tx.delete(teamMember).where(eq(teamMember.teamId, ctx.workspace.teamId));

    // Soft delete the team by setting deletedAt
    await tx.update(team).set({ deletedAt: new Date() }).where(eq(team.id, ctx.workspace.teamId));
  });

  return { success: true };
}

/**
 * List all teams the user is a member of (excludes soft-deleted teams)
 */
export async function listUserTeams(ctx: ProtectedTRPCContext) {
  const memberships = await ctx.db.query.teamMember.findMany({
    where: eq(teamMember.userId, ctx.auth.userId),
    with: {
      team: true,
    },
  });

  // Filter out soft-deleted teams
  return memberships
    .filter((m) => m.team.deletedAt === null)
    .map((m) => ({
      id: m.team.id,
      name: m.team.name,
      slug: m.team.slug,
      avatarUrl: m.team.avatarUrl,
      role: m.role,
    }));
}

/**
 * Check if a team slug is available
 * Excludes soft-deleted teams so slugs can be reused after cleanup
 */
export async function checkSlugAvailability(ctx: ProtectedTRPCContext, slug: string) {
  // Check reserved slugs first
  if (RESERVED_TEAM_SLUGS.includes(slug)) {
    return { available: false, reason: "This slug is reserved and cannot be used" };
  }

  // Only check active teams (not soft-deleted)
  const existingTeam = await ctx.db.query.team.findFirst({
    where: and(eq(team.slug, slug), isNull(team.deletedAt)),
  });

  if (existingTeam) {
    return { available: false, reason: "This slug is already taken" };
  }

  return { available: true };
}

// ============================================================================
// TEAM MEMBERS
// ============================================================================

/**
 * List all members of the current team
 */
export async function listMembers(ctx: TeamTRPCContext) {
  const members = await ctx.db.query.teamMember.findMany({
    where: eq(teamMember.teamId, ctx.workspace.teamId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
        },
      },
    },
  });

  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    createdAt: m.createdAt,
    user: m.user,
  }));
}

/**
 * Update a member's role
 */
export async function updateMemberRole(ctx: TeamTRPCContext, input: UpdateMemberRoleInput) {
  requirePermission(ctx.workspace, "team.settings", "update member role");

  const targetMember = await ctx.db.query.teamMember.findFirst({
    where: and(eq(teamMember.teamId, ctx.workspace.teamId), eq(teamMember.userId, input.userId)),
  });

  if (!targetMember) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Member not found",
    });
  }

  const roleChangeError = memberRoleChangeError(ctx.workspace.role, targetMember.role, input.role);
  if (roleChangeError) {
    throw new TRPCError({ code: "FORBIDDEN", message: roleChangeError });
  }

  await ctx.db
    .update(teamMember)
    .set({ role: input.role })
    .where(and(eq(teamMember.teamId, ctx.workspace.teamId), eq(teamMember.userId, input.userId)));

  return { success: true };
}

/**
 * Remove a member from the team
 */
export async function removeMember(ctx: TeamTRPCContext, input: RemoveMemberInput) {
  requirePermission(ctx.workspace, "team.remove_member", "remove team member");

  // Cannot remove self if owner
  if (input.userId === ctx.auth.userId && ctx.workspace.role === "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Owner cannot leave the team. Transfer ownership first.",
    });
  }

  // Cannot remove owner
  const targetMember = await ctx.db.query.teamMember.findFirst({
    where: and(eq(teamMember.teamId, ctx.workspace.teamId), eq(teamMember.userId, input.userId)),
  });

  if (!targetMember) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Member not found",
    });
  }

  if (targetMember.role === "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot remove the team owner",
    });
  }

  // Admin cannot remove other admins (only owner can)
  if (targetMember.role === "admin" && ctx.workspace.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the team owner can remove admins",
    });
  }

  await ctx.db
    .delete(teamMember)
    .where(and(eq(teamMember.teamId, ctx.workspace.teamId), eq(teamMember.userId, input.userId)));

  return { success: true };
}

/**
 * Leave the team (for non-owners)
 */
export async function leaveTeam(ctx: TeamTRPCContext) {
  if (ctx.workspace.role === "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Owner cannot leave the team. Transfer ownership first or delete the team.",
    });
  }

  await ctx.db
    .delete(teamMember)
    .where(
      and(eq(teamMember.teamId, ctx.workspace.teamId), eq(teamMember.userId, ctx.auth.userId)),
    );

  return { success: true };
}

/**
 * Transfer team ownership to another member
 */
export async function transferOwnership(ctx: TeamTRPCContext, input: TransferOwnershipInput) {
  requireMinimumRole(ctx.workspace, "owner", "transfer team ownership");

  // Check if new owner is a member
  const newOwner = await ctx.db.query.teamMember.findFirst({
    where: and(
      eq(teamMember.teamId, ctx.workspace.teamId),
      eq(teamMember.userId, input.newOwnerId),
    ),
  });

  if (!newOwner) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User is not a member of this team",
    });
  }

  // Teams are an Ultra feature and take their entitlements from the owner's plan.
  if (!(await userHasUltraPlan(input.newOwnerId, ctx.db))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "The new owner needs an Ultra plan to take over this team.",
    });
  }

  // Transfer in transaction
  await ctx.db.transaction(async (tx) => {
    // Demote current owner to admin
    await tx
      .update(teamMember)
      .set({ role: "admin" })
      .where(
        and(eq(teamMember.teamId, ctx.workspace.teamId), eq(teamMember.userId, ctx.auth.userId)),
      );

    // Promote new owner
    await tx
      .update(teamMember)
      .set({ role: "owner" })
      .where(
        and(eq(teamMember.teamId, ctx.workspace.teamId), eq(teamMember.userId, input.newOwnerId)),
      );

    // Update team owner reference; the new owner is on Ultra, so any owner-plan
    // grace period no longer applies.
    await tx
      .update(team)
      .set({ ownerId: input.newOwnerId, ownerPlanGraceEndsAt: null, ownerPlanGraceEmailStage: 0 })
      .where(eq(team.id, ctx.workspace.teamId));
  });

  return { success: true };
}

// ============================================================================
// TEAM INVITES
// ============================================================================

/**
 * Create an invite to join the team
 */
export async function createInvite(ctx: TeamTRPCContext, input: InviteMemberInput) {
  requirePermission(ctx.workspace, "team.invite", "invite team members");

  // Only owners can create admin invites
  if (input.role === "admin" && ctx.workspace.role !== "owner") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the team owner can invite admins",
    });
  }

  const email = input.email ? normalizeInviteEmail(input.email) : null;
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = addDays(now, 7);

  const recipient = email
    ? await ctx.db.query.user.findFirst({
        where: eq(user.email, email),
        columns: { id: true, name: true },
      })
    : undefined;

  if (recipient) {
    const existingMember = await ctx.db.query.teamMember.findFirst({
      where: and(eq(teamMember.teamId, ctx.workspace.teamId), eq(teamMember.userId, recipient.id)),
    });

    if (existingMember) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This user is already a member of the team",
      });
    }
  }

  const inviteId = await ctx.db.transaction(async (tx) => {
    if (email) {
      // Serialises email invites per team so two concurrent requests can't both
      // pass the duplicate and daily-limit checks below.
      await tx
        .select({ id: team.id })
        .from(team)
        .where(eq(team.id, ctx.workspace.teamId))
        .for("update");

      // LOWER() also matches invites stored before emails were normalised.
      const pending = await tx.query.teamInvite.findFirst({
        where: and(
          eq(teamInvite.teamId, ctx.workspace.teamId),
          sql`LOWER(${teamInvite.email}) = ${email}`,
          isNull(teamInvite.acceptedAt),
          isNull(teamInvite.declinedAt),
          isNull(teamInvite.revokedAt),
          gt(teamInvite.expiresAt, now),
        ),
        columns: { id: true },
      });

      if (pending) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "An invite to this email is already pending. Copy its link or revoke it from the Invites list.",
        });
      }

      const [sentToday] = await tx
        .select({ count: count() })
        .from(teamInvite)
        .where(
          and(
            eq(teamInvite.teamId, ctx.workspace.teamId),
            isNotNull(teamInvite.email),
            gte(teamInvite.createdAt, subDays(now, 1)),
          ),
        );

      if ((sentToday?.count ?? 0) >= DAILY_INVITE_EMAIL_LIMIT) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `This team has sent ${DAILY_INVITE_EMAIL_LIMIT} invite emails in the last 24 hours. Try again later, or create a link invite instead.`,
        });
      }
    }

    const [result] = await tx.insert(teamInvite).values({
      teamId: ctx.workspace.teamId,
      email,
      role: input.role,
      token,
      invitedBy: ctx.auth.userId,
      expiresAt,
    });

    return Number(result.insertId);
  });

  if (email) {
    const inviter = await ctx.db.query.user.findFirst({
      where: eq(user.id, ctx.auth.userId),
      columns: { name: true },
    });

    void runBackgroundTask(
      sendTeamInviteEmail({
        email,
        recipientName: recipient?.name,
        teamName: ctx.workspace.team.name,
        teamSlug: ctx.workspace.team.slug,
        inviterName: inviter?.name || "Someone",
        role: input.role,
        token,
      }),
    );
  }

  const baseDomain = getAppBaseDomain();

  return {
    inviteId,
    token,
    inviteUrl: `https://${baseDomain}/teams/accept-invite?token=${token}`,
    expiresAt,
  };
}

/**
 * List open invites for the team. Declined ones stay listed so the inviter can see the answer.
 */
export async function listInvites(ctx: TeamTRPCContext) {
  requirePermission(ctx.workspace, "team.invite", "view team invites");

  const invites = await ctx.db.query.teamInvite.findMany({
    where: and(
      eq(teamInvite.teamId, ctx.workspace.teamId),
      isNull(teamInvite.acceptedAt),
      isNull(teamInvite.revokedAt),
    ),
    with: {
      inviter: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: (table, { desc }) => desc(table.createdAt),
  });

  const now = new Date();
  return invites.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    token: i.token,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
    invitedBy: i.inviter,
    status: inviteStatus(i, now),
  }));
}

/**
 * Revoke a pending invite
 */
export async function revokeInvite(ctx: TeamTRPCContext, input: RevokeInviteInput) {
  requirePermission(ctx.workspace, "team.invite", "revoke team invite");

  const invite = await ctx.db.query.teamInvite.findFirst({
    where: and(
      eq(teamInvite.id, input.inviteId),
      eq(teamInvite.teamId, ctx.workspace.teamId),
      isNull(teamInvite.revokedAt),
    ),
  });

  if (!invite) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invite not found",
    });
  }

  await ctx.db
    .update(teamInvite)
    .set({ revokedAt: new Date() })
    .where(eq(teamInvite.id, input.inviteId));

  return { success: true };
}

/**
 * Accept a team invite (called from personal context)
 */
export async function acceptInvite(ctx: ProtectedTRPCContext, input: AcceptInviteInput) {
  const invite = await ctx.db.query.teamInvite.findFirst({
    where: and(eq(teamInvite.token, input.token), isNull(teamInvite.revokedAt)),
    with: {
      team: true,
    },
  });

  if (!invite) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invalid invite token",
    });
  }

  // Check if team has been soft-deleted
  if (invite.team.deletedAt !== null) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This team no longer exists",
    });
  }

  if (invite.acceptedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This invite has already been used",
    });
  }

  if (invite.declinedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This invite was declined. Ask a team admin for a new one.",
    });
  }

  if (invite.expiresAt < new Date()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This invite has expired",
    });
  }

  if (invite.email) {
    await assertInviteRecipient(ctx, invite.email);
  }

  if ((await getTeamAccess(invite.team, ctx.db)).readOnly) {
    throw new TRPCError({ code: "FORBIDDEN", message: TEAM_READ_ONLY_MESSAGE });
  }

  // Check if already a member
  const existingMember = await ctx.db.query.teamMember.findFirst({
    where: and(eq(teamMember.teamId, invite.teamId), eq(teamMember.userId, ctx.auth.userId)),
  });

  if (existingMember) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "You are already a member of this team",
    });
  }

  // Accept invite in transaction. The pre-checks above are advisory only: two
  // concurrent requests can both read acceptedAt = NULL, so the invite has to
  // be claimed with the NULL predicate in the UPDATE itself. Exactly one caller
  // sees a matched row; everyone else is rejected.
  await ctx.db.transaction(async (tx) => {
    const claim = await tx
      .update(teamInvite)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          eq(teamInvite.id, invite.id),
          isNull(teamInvite.acceptedAt),
          isNull(teamInvite.declinedAt),
          isNull(teamInvite.revokedAt),
        ),
      );

    if (claim[0].affectedRows === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This invite has already been used",
      });
    }

    // Add user as member
    await tx.insert(teamMember).values({
      teamId: invite.teamId,
      userId: ctx.auth.userId,
      role: invite.role,
    });
  });

  return {
    teamId: invite.team.id,
    teamSlug: invite.team.slug,
    teamName: invite.team.name,
  };
}

async function assertInviteRecipient(ctx: ProtectedTRPCContext, inviteEmail: string) {
  const currentUser = await ctx.db.query.user.findFirst({
    where: eq(user.id, ctx.auth.userId),
    columns: { email: true },
  });

  if (!inviteEmailMatches(inviteEmail, currentUser?.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This invite was sent to a different email address",
    });
  }
}

/**
 * Decline a team invite. The invite stays visible to the team as "Declined".
 */
export async function declineInvite(ctx: ProtectedTRPCContext, input: DeclineInviteInput) {
  const invite = await ctx.db.query.teamInvite.findFirst({
    where: and(eq(teamInvite.token, input.token), isNull(teamInvite.revokedAt)),
    columns: { id: true, email: true, acceptedAt: true, declinedAt: true, expiresAt: true },
  });

  if (!invite) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invalid invite token",
    });
  }

  if (invite.email) {
    await assertInviteRecipient(ctx, invite.email);
  }

  if (invite.declinedAt) {
    return { success: true };
  }

  if (inviteStatus(invite) !== "pending") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This invite has already been used or has expired",
    });
  }

  await ctx.db
    .update(teamInvite)
    .set({ declinedAt: new Date() })
    .where(and(eq(teamInvite.id, invite.id), isNull(teamInvite.acceptedAt)));

  return { success: true };
}

/**
 * Get invite details by token (public - for invite preview page)
 */
export async function getInviteByToken(ctx: ProtectedTRPCContext, token: string) {
  const invite = await ctx.db.query.teamInvite.findFirst({
    where: and(eq(teamInvite.token, token), isNull(teamInvite.revokedAt)),
    with: {
      team: {
        columns: {
          id: true,
          name: true,
          slug: true,
          avatarUrl: true,
          deletedAt: true,
        },
      },
      inviter: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!invite) {
    return null;
  }

  // Don't expose invites for soft-deleted teams
  if (invite.team.deletedAt !== null) {
    return null;
  }

  const membership = await ctx.db.query.teamMember.findFirst({
    where: and(eq(teamMember.teamId, invite.teamId), eq(teamMember.userId, ctx.auth.userId)),
    columns: { id: true },
  });

  return {
    team: {
      id: invite.team.id,
      name: invite.team.name,
      slug: invite.team.slug,
      avatarUrl: invite.team.avatarUrl,
    },
    role: invite.role,
    invitedBy: invite.inviter,
    view: inviteView(invite, !!membership),
  };
}

// ============================================================================
// WORKSPACE INFO
// ============================================================================

/**
 * Get current workspace info (for UI state)
 */
export async function getCurrentWorkspace(ctx: WorkspaceTRPCContext) {
  if (ctx.workspace.type === "personal") {
    return {
      type: "personal" as const,
      plan: ctx.workspace.plan,
    };
  }

  return {
    type: "team" as const,
    teamId: ctx.workspace.teamId,
    teamSlug: ctx.workspace.teamSlug,
    teamName: ctx.workspace.team.name,
    teamAvatar: ctx.workspace.team.avatarUrl,
    role: ctx.workspace.role,
    plan: "ultra" as const,
  };
}

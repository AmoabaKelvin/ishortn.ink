import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { getPlanCaps } from "@/lib/billing/plans";
import {
  customDomain,
  link,
  linkTag,
  qrcode,
} from "@/server/db/schema";
import {
  getTeamWorkspaceContextById,
  getUserTeams,
} from "@/server/lib/workspace/workspace.service";
import {
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";
import { getUserPlanContext } from "@/server/lib/user-plan";

import type { WorkspaceContext } from "@/server/lib/workspace/types";
import type { WorkspaceTRPCContext } from "../../trpc";

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface TransferLinksInput {
  linkIds: number[];
  targetWorkspaceType: "personal" | "team";
  targetTeamId?: number; // Required if targetWorkspaceType === "team"
}

export interface AvailableWorkspace {
  id: string; // "personal" or "team-{teamId}"
  type: "personal" | "team";
  teamId: number | null;
  name: string;
  slug: string | null;
  role: "owner" | "admin" | "member";
  plan: string;
  linkCount: number;
  linkLimit: number | undefined;
  isCurrent: boolean;
}

export interface TransferValidationResult {
  isValid: boolean;
  errors: Array<{
    type: "ALIAS_COLLISION" | "DOMAIN_MISSING" | "LIMIT_EXCEEDED" | "PERMISSION_DENIED" | "SAME_WORKSPACE";
    message: string;
    details?: Record<string, unknown>;
  }>;
  warnings: Array<{
    type: "TAGS_DROPPED" | "FOLDERS_RESET" | "QR_TRANSFERRED";
    message: string;
    count: number;
  }>;
  targetWorkspace: WorkspaceContext | null;
  linksCount: number;
}

export interface TransferResult {
  success: boolean;
  transferredCount: number;
  tagsDropped: number;
  qrCodesTransferred: number;
}

// ============================================================================
// GET AVAILABLE WORKSPACES
// ============================================================================

export async function getAvailableWorkspaces(
  ctx: WorkspaceTRPCContext
): Promise<AvailableWorkspace[]> {
  const workspaces: AvailableWorkspace[] = [];

  // Get personal workspace info
  const personalLinkCount = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(link)
    .where(and(eq(link.userId, ctx.auth.userId), isNull(link.teamId)));

  const planCtx = await getUserPlanContext(ctx.auth.userId, ctx.db);
  const personalPlan = planCtx?.plan ?? "free";
  const personalLimit = planCtx?.caps.linksLimit;

  const isCurrentPersonal = ctx.workspace.type === "personal";

  workspaces.push({
    id: "personal",
    type: "personal",
    teamId: null,
    name: "Personal Workspace",
    slug: null,
    role: "owner",
    plan: personalPlan,
    linkCount: Number(personalLinkCount[0]?.count ?? 0),
    linkLimit: personalLimit,
    isCurrent: isCurrentPersonal,
  });

  // Get user's teams
  const userTeams = await getUserTeams(ctx.auth.userId, ctx.db);

  for (const { team, role } of userTeams) {
    const teamLinkCount = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(link)
      .where(eq(link.teamId, team.id));

    const isCurrent =
      ctx.workspace.type === "team" && ctx.workspace.teamId === team.id;

    workspaces.push({
      id: `team-${team.id}`,
      type: "team",
      teamId: team.id,
      name: team.name,
      slug: team.slug,
      role: role as "owner" | "admin" | "member",
      plan: "ultra", // Teams always have Ultra
      linkCount: Number(teamLinkCount[0]?.count ?? 0),
      linkLimit: undefined, // Teams have unlimited links
      isCurrent,
    });
  }

  return workspaces;
}

// ============================================================================
// VALIDATE TRANSFER
// ============================================================================

export async function validateTransfer(
  ctx: WorkspaceTRPCContext,
  input: TransferLinksInput
): Promise<TransferValidationResult> {
  const { linkIds, targetWorkspaceType, targetTeamId } = input;
  const errors: TransferValidationResult["errors"] = [];
  const warnings: TransferValidationResult["warnings"] = [];

  // Check source workspace permissions
  // For team workspaces, only admin/owner can transfer out
  if (ctx.workspace.type === "team") {
    const allowedRoles = ["owner", "admin"];
    if (!allowedRoles.includes(ctx.workspace.role)) {
      errors.push({
        type: "PERMISSION_DENIED",
        message: "Only team owners and admins can transfer links to other workspaces",
      });
      return {
        isValid: false,
        errors,
        warnings,
        targetWorkspace: null,
        linksCount: linkIds.length,
      };
    }
  }

  // Resolve target workspace
  let targetWorkspace: WorkspaceContext;

  if (targetWorkspaceType === "team") {
    if (!targetTeamId) {
      errors.push({
        type: "PERMISSION_DENIED",
        message: "Target team ID is required for team workspace transfers",
      });
      return {
        isValid: false,
        errors,
        warnings,
        targetWorkspace: null,
        linksCount: linkIds.length,
      };
    }

    try {
      targetWorkspace = await getTeamWorkspaceContextById(
        ctx.auth.userId,
        targetTeamId,
        ctx.db
      );
    } catch {
      errors.push({
        type: "PERMISSION_DENIED",
        message: "You are not a member of the target team",
      });
      return {
        isValid: false,
        errors,
        warnings,
        targetWorkspace: null,
        linksCount: linkIds.length,
      };
    }
  } else {
    // Personal workspace
    const planCtx = await getUserPlanContext(ctx.auth.userId, ctx.db);
    targetWorkspace = {
      type: "personal",
      userId: ctx.auth.userId,
      teamId: null,
      teamSlug: null,
      role: "owner",
      plan: planCtx?.plan ?? "free",
    };
  }

  // Check if transferring to same workspace
  if (
    (ctx.workspace.type === "personal" && targetWorkspace.type === "personal") ||
    (ctx.workspace.type === "team" &&
      targetWorkspace.type === "team" &&
      ctx.workspace.teamId === targetWorkspace.teamId)
  ) {
    errors.push({
      type: "SAME_WORKSPACE",
      message: "Cannot transfer links to the same workspace",
    });
    return {
      isValid: false,
      errors,
      warnings,
      targetWorkspace,
      linksCount: linkIds.length,
    };
  }

  // Verify all links exist and belong to source workspace
  const sourceLinks = await ctx.db.query.link.findMany({
    where: and(
      inArray(link.id, linkIds),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (sourceLinks.length !== linkIds.length) {
    errors.push({
      type: "PERMISSION_DENIED",
      message: `Some links not found in current workspace. Found ${sourceLinks.length} of ${linkIds.length} links.`,
    });
    return {
      isValid: false,
      errors,
      warnings,
      targetWorkspace,
      linksCount: linkIds.length,
    };
  }

  // Check target workspace link limits (only for personal workspace)
  if (targetWorkspace.type === "personal") {
    const planCtx = await getUserPlanContext(ctx.auth.userId, ctx.db);
    const limit = planCtx?.caps.linksLimit;

    if (limit !== undefined) {
      const currentCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(link)
        .where(and(eq(link.userId, ctx.auth.userId), isNull(link.teamId)));

      const newTotal = Number(currentCount[0]?.count ?? 0) + linkIds.length;

      if (newTotal > limit) {
        errors.push({
          type: "LIMIT_EXCEEDED",
          message: `Transfer would exceed target workspace limit. Current: ${currentCount[0]?.count ?? 0}, Limit: ${limit}, Transferring: ${linkIds.length}`,
          details: {
            currentCount: Number(currentCount[0]?.count ?? 0),
            limit,
            transferring: linkIds.length,
          },
        });
      }
    }
  }

  // Check for alias collisions in target workspace
  const aliases = sourceLinks.map((l) => l.alias).filter(Boolean) as string[];
  const domains = [...new Set(sourceLinks.map((l) => l.domain))];

  for (const domain of domains) {
    const aliasesForDomain = sourceLinks
      .filter((l) => l.domain === domain)
      .map((l) => l.alias)
      .filter(Boolean) as string[];

    if (aliasesForDomain.length === 0) continue;

    const existingAliases = await ctx.db
      .select({ alias: link.alias })
      .from(link)
      .where(
        and(
          inArray(link.alias, aliasesForDomain),
          eq(link.domain, domain),
          targetWorkspace.type === "team"
            ? eq(link.teamId, targetWorkspace.teamId)
            : and(eq(link.userId, ctx.auth.userId), isNull(link.teamId))
        )
      );

    if (existingAliases.length > 0) {
      errors.push({
        type: "ALIAS_COLLISION",
        message: `Alias collision on ${domain}: ${existingAliases.map((a) => a.alias).join(", ")}`,
        details: {
          domain,
          aliases: existingAliases.map((a) => a.alias),
        },
      });
    }
  }

  // Check custom domain availability in target workspace
  const customDomains = [
    ...new Set(sourceLinks.filter((l) => l.domain !== "ishortn.ink").map((l) => l.domain)),
  ];

  if (customDomains.length > 0) {
    const targetDomains = await ctx.db.query.customDomain.findMany({
      where: and(
        inArray(customDomain.domain, customDomains),
        targetWorkspace.type === "team"
          ? eq(customDomain.teamId, targetWorkspace.teamId)
          : and(eq(customDomain.userId, ctx.auth.userId), isNull(customDomain.teamId))
      ),
    });

    const targetDomainSet = new Set(targetDomains.map((d) => d.domain));
    const missingDomains = customDomains.filter((d) => !targetDomainSet.has(d));

    if (missingDomains.length > 0) {
      errors.push({
        type: "DOMAIN_MISSING",
        message: `Custom domains not available in target workspace: ${missingDomains.join(", ")}`,
        details: { domains: missingDomains },
      });
    }
  }

  // Calculate warnings
  // Tags to be dropped
  const tagCount = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(linkTag)
    .where(inArray(linkTag.linkId, linkIds));

  if (Number(tagCount[0]?.count ?? 0) > 0) {
    warnings.push({
      type: "TAGS_DROPPED",
      message: `${tagCount[0]?.count} tag associations will be removed (tags are workspace-specific)`,
      count: Number(tagCount[0]?.count ?? 0),
    });
  }

  // Folders to be reset
  const linksWithFolders = sourceLinks.filter((l) => l.folderId !== null);
  if (linksWithFolders.length > 0) {
    warnings.push({
      type: "FOLDERS_RESET",
      message: `${linksWithFolders.length} links will be removed from their folders`,
      count: linksWithFolders.length,
    });
  }

  // QR codes to be transferred
  const qrCodeCount = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(qrcode)
    .where(inArray(qrcode.linkId, linkIds));

  if (Number(qrCodeCount[0]?.count ?? 0) > 0) {
    warnings.push({
      type: "QR_TRANSFERRED",
      message: `${qrCodeCount[0]?.count} QR codes will be transferred with the links`,
      count: Number(qrCodeCount[0]?.count ?? 0),
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    targetWorkspace,
    linksCount: linkIds.length,
  };
}

// ============================================================================
// EXECUTE TRANSFER
// ============================================================================

export async function transferLinksToWorkspace(
  ctx: WorkspaceTRPCContext,
  input: TransferLinksInput
): Promise<TransferResult> {
  const { linkIds, targetWorkspaceType, targetTeamId } = input;

  // Validate the transfer first
  const validation = await validateTransfer(ctx, input);

  if (!validation.isValid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: validation.errors[0]?.message ?? "Transfer validation failed",
    });
  }

  if (!validation.targetWorkspace) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Target workspace could not be resolved",
    });
  }

  const targetOwnership = workspaceOwnership(validation.targetWorkspace);

  // Execute transfer in transaction
  return await ctx.db.transaction(async (tx) => {
    // 1. Update link ownership and reset folder
    await tx
      .update(link)
      .set({
        userId: targetOwnership.userId,
        teamId: targetOwnership.teamId,
        folderId: null, // Reset folder assignment
      })
      .where(
        and(
          inArray(link.id, linkIds),
          workspaceFilter(ctx.workspace, link.userId, link.teamId)
        )
      );

    // 2. Delete tag associations (tags are workspace-scoped)
    await tx
      .delete(linkTag)
      .where(inArray(linkTag.linkId, linkIds));

    // 3. Transfer QR codes
    await tx
      .update(qrcode)
      .set({
        userId: targetOwnership.userId,
        teamId: targetOwnership.teamId,
      })
      .where(inArray(qrcode.linkId, linkIds));

    // Note: linkVisit and uniqueLinkVisit are NOT updated
    // They reference linkId, not workspace, so analytics are preserved

    return {
      success: true,
      transferredCount: linkIds.length,
      tagsDropped: validation.warnings.find((w) => w.type === "TAGS_DROPPED")?.count ?? 0,
      qrCodesTransferred: validation.warnings.find((w) => w.type === "QR_TRANSFERRED")?.count ?? 0,
    };
  });
}

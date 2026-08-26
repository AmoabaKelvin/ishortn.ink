import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, ne, sum } from "drizzle-orm";

import { isSubscriptionEntitled, PLAN_CAPS, resolvePlan } from "@/lib/billing/plans";
import { customDomain, link, linkVisit, linkVisitDailySummary, teamMember } from "@/server/db/schema";
import {
  requirePermission,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import {
  addCustomHostname,
  buildVerificationChallenges,
  deleteCustomHostname,
  getCustomHostname,
  mapStatus,
} from "./cloudflare";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { CreateCustomDomainInput } from "./domains.input";

/**
 * True when at least one of the existing claims on a domain sits in a workspace
 * the caller belongs to — their own personal workspace, or a team they are a
 * member of. Used to allow the documented "same domain across my workspaces"
 * flow while refusing a claim on a stranger's verified domain.
 */
async function callerControlsAClaim(
  ctx: WorkspaceTRPCContext,
  claims: { userId: string; teamId: number | null }[],
): Promise<boolean> {
  if (claims.some((claim) => claim.teamId === null && claim.userId === ctx.auth.userId)) {
    return true;
  }

  const teamIds = claims
    .map((claim) => claim.teamId)
    .filter((teamId): teamId is number => teamId !== null);

  if (teamIds.length === 0) return false;

  const membership = await ctx.db.query.teamMember.findFirst({
    where: and(eq(teamMember.userId, ctx.auth.userId), inArray(teamMember.teamId, teamIds)),
    columns: { id: true },
  });

  return !!membership;
}

export async function addDomainToUserAccount(
  ctx: WorkspaceTRPCContext,
  input: CreateCustomDomainInput,
) {
  // Check permission for domain creation (owners only in team workspaces)
  requirePermission(ctx.workspace, "domains.create", "add custom domains. Only team owners can manage domains");

  const userId = ctx.auth.userId;

  const userSubscription = await ctx.db.query.subscription.findFirst({
    where: (table, { eq }) => eq(table.userId, userId),
  });

  if (!isSubscriptionEntitled(userSubscription)) {
    throw new Error("You need to have an active subscription to add a custom domain");
  }

  // Enforce the per-plan custom-domain cap (workspace-scoped)
  const plan = resolvePlan(userSubscription);
  const domainLimit = PLAN_CAPS[plan].domainLimit;

  if (domainLimit !== undefined) {
    const existingDomainsCount = await ctx.db
      .select({ count: count() })
      .from(customDomain)
      .where(workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId));

    const existingCount = existingDomainsCount[0]?.count ?? 0;

    if (existingCount >= domainLimit) {
      throw new Error(
        `You've reached your plan's limit of ${domainLimit} custom domains. Upgrade to add more.`,
      );
    }
  }

  // remove http, https, and www. from the domain
  const domain = input.domain.replace("http://", "").replace("https://", "").replace("www.", "");

  const ownership = workspaceOwnership(ctx.workspace);

  // Check if the domain already exists in the current workspace
  const existingDomainInWorkspace = await ctx.db.query.customDomain.findFirst({
    where: and(
      eq(customDomain.domain, domain),
      workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId)
    ),
  });

  if (existingDomainInWorkspace) {
    throw new Error("This domain is already added to this workspace");
  }

  // Cloudflare holds one custom hostname per zone, so a domain another tenant
  // has already verified would sail through the `alreadyExists` branch below
  // and land as "active" here with no DNS challenge of our own. Domain sharing is
  // only meant to span workspaces the same person controls, so require an
  // existing claim in one of the caller's workspaces before inheriting state.
  const existingClaims = await ctx.db.query.customDomain.findMany({
    where: eq(customDomain.domain, domain),
    columns: { userId: true, teamId: true },
  });

  if (existingClaims.length > 0 && !(await callerControlsAClaim(ctx, existingClaims))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "This domain is already connected to another account. Remove it there first, or contact support if you own it.",
    });
  }

  try {
    const response = await addCustomHostname(domain);

    // If the hostname already exists on the zone (added by another workspace), reuse it
    const hostname = response.alreadyExists ? await getCustomHostname(domain) : response.hostname;

    if (!hostname) {
      throw new Error("Failed to retrieve domain configuration");
    }

    await ctx.db.insert(customDomain).values({
      userId: ownership.userId,
      teamId: ownership.teamId,
      domain: domain,
      status: mapStatus(hostname),
      verificationDetails: buildVerificationChallenges(domain, hostname),
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to add domain");
  }

  return { success: true };
}

export async function getCustomDomainsForUser(ctx: WorkspaceTRPCContext) {
  const customDomains = await ctx.db.query.customDomain.findMany({
    where: workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
  });

  return customDomains;
}

export async function deleteDomainAndAssociatedLinks(ctx: WorkspaceTRPCContext, domainId: number) {
  // Check permission for domain deletion (owners only in team workspaces)
  requirePermission(ctx.workspace, "domains.delete", "delete custom domains. Only team owners can manage domains");

  const domain = await ctx.db.query.customDomain.findFirst({
    where: and(
      eq(customDomain.id, domainId),
      workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId)
    ),
  });

  if (!domain) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Domain not found or you don't have permission to delete it",
    });
  }

  // Start a transaction to ensure all operations succeed or fail together
  return await ctx.db.transaction(async (tx) => {
    // Delete all links associated with this domain
    const linksToDelete = await tx
      .select({ id: link.id })
      .from(link)
      .where(and(eq(link.domain, domain.domain!), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

    const linkIds = linksToDelete.map((link) => link.id);

    // delete all link visits
    if (linkIds.length > 0) {
      await tx.delete(linkVisit).where(inArray(linkVisit.linkId, linkIds));
    }

    // delete all links
    await tx.delete(link).where(and(eq(link.domain, domain.domain!), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

    // Check if other workspaces are using this domain BEFORE deleting
    const otherWorkspacesUsingDomain = await tx.query.customDomain.findFirst({
      where: and(
        eq(customDomain.domain, domain.domain!),
        ne(customDomain.id, domainId)
      ),
    });

    // If no other workspaces use this domain, delete from Cloudflare first
    if (!otherWorkspacesUsingDomain) {
      await deleteCustomHostname(domain.domain!);
    }

    // Delete the domain record from our database
    await tx.delete(customDomain).where(eq(customDomain.id, domainId));

    return { success: true, message: "Domain and associated links deleted successfully" };
  });
}

export async function getDomainStatistics(ctx: WorkspaceTRPCContext, domain: string) {
  // Get all links for this domain in the current workspace
  const domainLinks = await ctx.db
    .select({
      id: link.id,
      createdAt: link.createdAt,
    })
    .from(link)
    .where(and(eq(link.domain, domain), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

  const linkIds = domainLinks.map((l) => l.id);

  // Calculate link count
  const linkCount = domainLinks.length;

  // Calculate total clicks (raw visits + archived clicks rolled up by the
  // analytics cleanup job)
  let totalClicks = 0;
  if (linkIds.length > 0) {
    const [clicksResult, archivedResult] = await Promise.all([
      ctx.db
        .select({ count: count() })
        .from(linkVisit)
        .where(inArray(linkVisit.linkId, linkIds)),
      ctx.db
        .select({ total: sum(linkVisitDailySummary.clicks) })
        .from(linkVisitDailySummary)
        .where(inArray(linkVisitDailySummary.linkId, linkIds)),
    ]);

    totalClicks =
      (clicksResult[0]?.count ?? 0) + (Number(archivedResult[0]?.total) || 0);
  }

  // Find last used date (most recent link creation)
  const lastUsedAt = domainLinks.length > 0
    ? domainLinks.reduce((latest, current) => {
        const currentDate = current.createdAt ? new Date(current.createdAt) : null;
        if (!currentDate) return latest;
        if (!latest) return currentDate;
        return currentDate > latest ? currentDate : latest;
      }, null as Date | null)
    : null;

  return {
    linkCount,
    totalClicks,
    lastUsedAt,
  };
}

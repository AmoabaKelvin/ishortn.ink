import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, isNull, lt, ne, or, sum } from "drizzle-orm";
import { getDomain } from "tldts";

import { isSubscriptionEntitled, PLAN_CAPS, resolvePlan } from "@/lib/billing/plans";
import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/constants/moderation";
import { deleteFromCache } from "@/lib/core/cache";
import { logger } from "@/lib/logger";
import {
  bioPage,
  customDomain,
  link,
  linkVisit,
  linkVisitDailySummary,
  siteSettings,
  team,
  teamMember,
  user,
} from "@/server/db/schema";
import {
  hasPermission,
  requirePermission,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import {
  addCustomHostname,
  buildVerificationChallenges,
  deleteCustomHostname,
  DomainServiceError,
  getLiveCustomHostname,
  mapStatus,
  wwwFallbackActive,
} from "./cloudflare";
import { DOMAIN_MIGRATION_CUTOFF } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { CloudflareCustomHostname } from "./cloudflare";
import type { CreateCustomDomainInput } from "./domains.input";

const log = logger.child({ component: "domains.service" });

/**
 * Keeps raw Cloudflare, config and database errors out of toasts: they are
 * logged here and the client gets `fallback` instead.
 */
function toUserFacingError(cause: unknown, fallback: string): TRPCError {
  if (cause instanceof TRPCError) return cause;
  if (cause instanceof DomainServiceError) {
    return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: cause.message });
  }
  log.error({ err: cause }, fallback);
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallback });
}

// Bio pages store their domain without "www." (see updateBioPage), so
// www.brand.com and brand.com serve the same page.
const bioPageDomain = (domain: string) => domain.replace(/^www\./, "");

async function isHostnameActive(domain: string, hostname: CloudflareCustomHostname | null) {
  return (hostname !== null && mapStatus(hostname) === "active") || wwwFallbackActive(domain);
}

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
  requirePermission(
    ctx.workspace,
    "domains.create",
    "add custom domains. Only team owners can manage domains",
  );

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

  // The input schema already normalised this to a lowercase hostname
  const domain = input.domain;

  if (!getDomain(domain)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Enter a domain you own, like links.example.com.",
    });
  }

  const ownership = workspaceOwnership(ctx.workspace);

  // Check if the domain already exists in the current workspace
  const existingDomainInWorkspace = await ctx.db.query.customDomain.findFirst({
    where: and(
      eq(customDomain.domain, domain),
      workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
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
  const existingClaims = await ctx.db
    .select({
      userId: customDomain.userId,
      teamId: customDomain.teamId,
      ownerRestrictedAt: user.restrictedAt,
    })
    .from(customDomain)
    .leftJoin(user, eq(user.id, customDomain.userId))
    .where(eq(customDomain.domain, domain));

  // Restricting an account released its hostnames; another workspace (e.g. a
  // teammate it invited) must not put them back on Cloudflare.
  if (existingClaims.some((claim) => claim.ownerRestrictedAt)) {
    throw new TRPCError({ code: "FORBIDDEN", message: ACCOUNT_RESTRICTED_MESSAGE });
  }

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
    const hostname = response.alreadyExists
      ? await getLiveCustomHostname(domain)
      : response.hostname;

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
    throw toUserFacingError(
      error,
      "We couldn't add this domain right now. Please try again in a few minutes.",
    );
  }

  return { success: true };
}

export async function getCustomDomainsForUser(ctx: WorkspaceTRPCContext) {
  const customDomains = await ctx.db.query.customDomain.findMany({
    where: workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
  });

  return customDomains;
}

export async function deleteDomainAndAssociatedLinks(
  ctx: WorkspaceTRPCContext,
  domainId: number,
  {
    removeHostname = deleteCustomHostname,
  }: { removeHostname?: (domain: string) => Promise<void> } = {},
) {
  // Check permission for domain deletion (owners only in team workspaces)
  requirePermission(
    ctx.workspace,
    "domains.delete",
    "delete custom domains. Only team owners can manage domains",
  );

  const domain = await ctx.db.query.customDomain.findFirst({
    where: and(
      eq(customDomain.id, domainId),
      workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
    ),
  });

  if (!domain?.domain) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Domain not found or you don't have permission to delete it",
    });
  }

  const domainName = domain.domain;

  try {
    // Start a transaction to ensure all operations succeed or fail together
    await ctx.db.transaction(async (tx) => {
      // Delete all links associated with this domain
      const linksToDelete = await tx
        .select({ id: link.id })
        .from(link)
        .where(
          and(
            eq(link.domain, domainName),
            workspaceFilter(ctx.workspace, link.userId, link.teamId),
          ),
        );

      const linkIds = linksToDelete.map((link) => link.id);

      // delete all link visits
      if (linkIds.length > 0) {
        await tx.delete(linkVisit).where(inArray(linkVisit.linkId, linkIds));
      }

      // delete all links
      await tx
        .delete(link)
        .where(
          and(
            eq(link.domain, domainName),
            workspaceFilter(ctx.workspace, link.userId, link.teamId),
          ),
        );

      // Point the workspace default back at the platform domain, or quick
      // links would keep landing on a domain that no longer serves them
      if (domain.teamId === null) {
        await tx
          .update(siteSettings)
          .set({ defaultDomain: DEFAULT_PLATFORM_DOMAIN })
          .where(
            and(eq(siteSettings.userId, domain.userId), eq(siteSettings.defaultDomain, domainName)),
          );
      } else {
        await tx
          .update(team)
          .set({ defaultDomain: DEFAULT_PLATFORM_DOMAIN })
          .where(and(eq(team.id, domain.teamId), eq(team.defaultDomain, domainName)));
      }

      // A bio page on brand.com is also served by www.brand.com, so it only
      // loses its domain when neither hostname remains in this workspace
      const bioDomain = bioPageDomain(domainName);
      const remainingBioHost = await tx.query.customDomain.findFirst({
        where: and(
          inArray(customDomain.domain, [bioDomain, `www.${bioDomain}`]),
          ne(customDomain.id, domainId),
          workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
        ),
        columns: { id: true },
      });

      if (!remainingBioHost) {
        await tx
          .update(bioPage)
          .set({ customDomain: null })
          .where(
            and(
              eq(bioPage.customDomain, bioDomain),
              workspaceFilter(ctx.workspace, bioPage.userId, bioPage.teamId),
            ),
          );
      }

      // Check if other workspaces are using this domain BEFORE deleting
      const otherWorkspacesUsingDomain = await tx.query.customDomain.findFirst({
        where: and(eq(customDomain.domain, domainName), ne(customDomain.id, domainId)),
      });

      // If no other workspaces use this domain, delete from Cloudflare first
      if (!otherWorkspacesUsingDomain) {
        await removeHostname(domainName);
      }

      // Delete the domain record from our database
      await tx.delete(customDomain).where(eq(customDomain.id, domainId));
    });
  } catch (error) {
    throw toUserFacingError(
      error,
      "We couldn't delete this domain right now. Please try again in a few minutes.",
    );
  }

  // After the commit, so a concurrent read can't cache the old default again
  await deleteFromCache(
    domain.teamId === null
      ? `user_settings_domain:${domain.userId}`
      : `team_default_domain:${domain.teamId}`,
  );

  return { success: true, message: "Domain and associated links deleted successfully" };
}

export async function checkDomainStatus(ctx: WorkspaceTRPCContext, domainName: string) {
  // Look the domain up in the caller's workspace first: the Cloudflare call
  // below can re-arm validation, which must not run on someone else's hostname
  const record = await ctx.db.query.customDomain.findFirst({
    where: and(
      eq(customDomain.domain, domainName),
      workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
    ),
    columns: { id: true, domain: true },
  });

  if (!record?.domain) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Domain not found" });
  }

  const domain = record.domain;
  let hostname: CloudflareCustomHostname | null;
  let active: boolean;

  try {
    hostname = await getLiveCustomHostname(domain);
    active = await isHostnameActive(domain, hostname);
  } catch (error) {
    throw toUserFacingError(
      error,
      "We couldn't check this domain right now. Please try again in a moment.",
    );
  }

  log.debug(
    {
      domain,
      hostnameStatus: hostname?.status ?? "not_found",
      sslStatus: hostname?.ssl?.status ?? "not_found",
    },
    "Cloudflare custom hostname state",
  );

  if (active) {
    await ctx.db
      .update(customDomain)
      .set({ status: "active" })
      .where(eq(customDomain.id, record.id));
    return { status: "active" as const };
  }

  const verificationChallenges = buildVerificationChallenges(domain, hostname);

  // Refresh stored challenges so the dashboard and reminder emails show the
  // current Cloudflare records instead of stale ones
  await ctx.db
    .update(customDomain)
    .set({ verificationDetails: JSON.stringify(verificationChallenges) })
    .where(eq(customDomain.id, record.id));

  return { status: "pending" as const, verificationChallenges };
}

/**
 * Domains from before the Cloudflare move that still aren't serving there.
 * Domains added since then show their own "Pending" state instead.
 */
export async function getDomainsNeedingMigration(
  ctx: WorkspaceTRPCContext,
  {
    lookupHostname = getLiveCustomHostname,
  }: { lookupHostname?: typeof getLiveCustomHostname } = {},
) {
  // Only people who can manage domains can act on the notice
  if (!hasPermission(ctx.workspace, "domains.create")) return [];

  const legacyDomains = await ctx.db.query.customDomain.findMany({
    where: and(
      workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
      // Rows without a timestamp predate the column default, so they are old too
      or(isNull(customDomain.createdAt), lt(customDomain.createdAt, DOMAIN_MIGRATION_CUTOFF)),
    ),
    columns: { domain: true },
  });

  const results = await Promise.all(
    legacyDomains.map(async ({ domain }) => {
      if (!domain) return null;

      try {
        const hostname = await lookupHostname(domain);
        if (await isHostnameActive(domain, hostname)) return null;

        return {
          domain,
          records: buildVerificationChallenges(domain, hostname).map((challenge) => ({
            type: challenge.type,
            name: challenge.domain,
            fqdn: challenge.fqdn,
            value: challenge.value,
          })),
        };
      } catch (error) {
        // A failed lookup says nothing about the domain. Treating it as
        // "needs migration" would put the notice in front of every customer
        // during a Cloudflare outage.
        log.warn({ err: error, domain }, "migration status check failed");
        return null;
      }
    }),
  );

  return results.filter((entry) => entry !== null);
}

export async function getDomainStatistics(ctx: WorkspaceTRPCContext, domain: string) {
  // Get all links for this domain in the current workspace, and the bio page
  // served on it (named in the delete confirmation)
  const [domainLinks, attachedBioPage] = await Promise.all([
    ctx.db
      .select({
        id: link.id,
        createdAt: link.createdAt,
      })
      .from(link)
      .where(
        and(eq(link.domain, domain), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
      ),
    ctx.db.query.bioPage.findFirst({
      where: and(
        eq(bioPage.customDomain, bioPageDomain(domain)),
        workspaceFilter(ctx.workspace, bioPage.userId, bioPage.teamId),
      ),
      columns: { title: true, slug: true },
    }),
  ]);

  const linkIds = domainLinks.map((l) => l.id);

  // Calculate link count
  const linkCount = domainLinks.length;

  // Calculate total clicks (raw visits + archived clicks rolled up by the
  // analytics cleanup job)
  let totalClicks = 0;
  if (linkIds.length > 0) {
    const [clicksResult, archivedResult] = await Promise.all([
      ctx.db.select({ count: count() }).from(linkVisit).where(inArray(linkVisit.linkId, linkIds)),
      ctx.db
        .select({ total: sum(linkVisitDailySummary.clicks) })
        .from(linkVisitDailySummary)
        .where(inArray(linkVisitDailySummary.linkId, linkIds)),
    ]);

    totalClicks = (clicksResult[0]?.count ?? 0) + (Number(archivedResult[0]?.total) || 0);
  }

  // Find last used date (most recent link creation)
  const lastUsedAt =
    domainLinks.length > 0
      ? domainLinks.reduce<Date | null>((latest, current) => {
          const currentDate = current.createdAt ? new Date(current.createdAt) : null;
          if (!currentDate) return latest;
          if (!latest) return currentDate;
          return currentDate > latest ? currentDate : latest;
        }, null)
      : null;

  return {
    linkCount,
    totalClicks,
    lastUsedAt,
    bioPage: attachedBioPage ?? null,
  };
}

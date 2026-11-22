import { TRPCError } from "@trpc/server";
import {
  and,
  between,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { resolvePlan } from "@/lib/billing/plans";
import { PAID_PLANS, PLAN_PRICES_USD, type PaidPlan } from "@/lib/constants/plan-pricing";
import { buildCacheKey, deleteFromCache } from "@/lib/core/cache";
import { logger } from "@/lib/logger";
import {
  bioPage,
  blockedDomain,
  campaign,
  customDomain,
  emailSuppression,
  feedback,
  flaggedLink,
  link,
  linkVisit,
  subscription,
  user,
  userAttribution,
} from "@/server/db/schema";

import {
  addCustomHostname,
  buildVerificationChallenges,
  deleteCustomHostname,
  getCustomHostname,
  getLiveCustomHostname,
  isApexHostname,
  mapStatus,
} from "../domains/cloudflare";
import { domainCanGoLive, isHostnameActive, notRejectedDomain } from "../domains/domains.service";
import { RESTRICTED_LINK_REASON } from "../link/utils";

import type { ProtectedTRPCContext } from "../../trpc";

/** Discriminator used to identify links auto-blocked by a user ban */
const BAN_CASCADE_REASON = "Owner account banned" as const;
import { buildSignupSeries, summarizeSignupGroups } from "./utils";

import type {
  AddBlockedDomainInput,
  ApproveHeldDomainInput,
  BanUserInput,
  BlockLinkInput,
  GetActivityChartInput,
  GetAnalyticsInput,
  GetFlaggedLinksInput,
  GetMonthlyBreakdownInput,
  GetPeakPeriodsInput,
  GetRecentSubscriptionsInput,
  GetSubscriptionTimelineInput,
  GetTopLinksInput,
  GetTopUsersInput,
  GetUserBaseSummaryInput,
  RejectHeldDomainInput,
  RemoveBlockedDomainInput,
  ResolveFlaggedLinkInput,
  RestrictUserInput,
  SearchLinksInput,
  SearchUsersInput,
  UnbanUserInput,
  UnblockLinkInput,
  UnrestrictUserInput,
} from "./admin.input";

const log = logger.child({ component: "admin.service" });

export async function getStats(ctx: ProtectedTRPCContext) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [linkStatsResult, userStatsResult, pendingFlaggedResult, blockedDomainsResult] =
    await Promise.all([
      // Single scan: total links + blocked links + today's links
      ctx.db
        .select({
          total: count(),
          blocked: sql<number>`SUM(${link.blocked} = true)`,
          today: sql<number>`SUM(${link.createdAt} >= ${today})`,
        })
        .from(link),
      // Single scan: total users + banned users + today's users
      ctx.db
        .select({
          total: count(),
          banned: sql<number>`SUM(${user.banned} = true)`,
          today: sql<number>`SUM(${user.createdAt} >= ${today})`,
        })
        .from(user),
      ctx.db.select({ count: count() }).from(flaggedLink).where(eq(flaggedLink.status, "pending")),
      ctx.db.select({ count: count() }).from(blockedDomain),
    ]);

  return {
    totalLinks: linkStatsResult[0]?.total ?? 0,
    totalUsers: userStatsResult[0]?.total ?? 0,
    blockedLinks: linkStatsResult[0]?.blocked ?? 0,
    pendingFlagged: pendingFlaggedResult[0]?.count ?? 0,
    bannedUsers: userStatsResult[0]?.banned ?? 0,
    blockedDomains: blockedDomainsResult[0]?.count ?? 0,
    linksToday: linkStatsResult[0]?.today ?? 0,
    usersToday: userStatsResult[0]?.today ?? 0,
  };
}

export async function getDailyStats(ctx: ProtectedTRPCContext) {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  const [dailyLinks, dailyUsers] = await Promise.all([
    ctx.db
      .select({
        date: sql<string>`DATE(${link.createdAt})`,
        count: count(),
      })
      .from(link)
      .where(sql`${link.createdAt} >= ${fourteenDaysAgo}`)
      .groupBy(sql`DATE(${link.createdAt})`)
      .orderBy(sql`DATE(${link.createdAt})`),
    ctx.db
      .select({
        date: sql<string>`DATE(${user.createdAt})`,
        count: count(),
      })
      .from(user)
      .where(sql`${user.createdAt} >= ${fourteenDaysAgo}`)
      .groupBy(sql`DATE(${user.createdAt})`)
      .orderBy(sql`DATE(${user.createdAt})`),
  ]);

  // Index by date string for O(1) lookups (normalize in case driver returns Date)
  const linksByDate = new Map(dailyLinks.map((l) => [String(l.date).split("T")[0], l.count]));
  const usersByDate = new Map(dailyUsers.map((u) => [String(u.date).split("T")[0], u.count]));

  // Fill in all 14 days (including days with 0 activity)
  const result: { date: string; links: number; users: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0]!;
    result.push({
      date: dateStr,
      links: linksByDate.get(dateStr) ?? 0,
      users: usersByDate.get(dateStr) ?? 0,
    });
  }

  return result;
}

export async function getRecentUsers(ctx: ProtectedTRPCContext) {
  const recent = await ctx.db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl,
      createdAt: user.createdAt,
      banned: user.banned,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(8);

  if (recent.length === 0) return [];

  const counts = await ctx.db
    .select({ userId: link.userId, linkCount: count() })
    .from(link)
    .where(
      inArray(
        link.userId,
        recent.map((u) => u.id),
      ),
    )
    .groupBy(link.userId);

  const countsByUser = new Map(counts.map((c) => [c.userId, c.linkCount]));
  return recent.map((u) => ({ ...u, linkCount: countsByUser.get(u.id) ?? 0 }));
}

export async function getRecentActivity(ctx: ProtectedTRPCContext) {
  const [recentLinks, recentBlocked] = await Promise.all([
    ctx.db
      .select({
        id: link.id,
        url: link.url,
        alias: link.alias,
        domain: link.domain,
        createdAt: link.createdAt,
        userEmail: user.email,
      })
      .from(link)
      .leftJoin(user, eq(link.userId, user.id))
      .orderBy(desc(link.createdAt))
      .limit(8),
    ctx.db
      .select({
        id: link.id,
        url: link.url,
        alias: link.alias,
        domain: link.domain,
        blockedAt: link.blockedAt,
        blockedReason: link.blockedReason,
        userEmail: user.email,
      })
      .from(link)
      .leftJoin(user, eq(link.userId, user.id))
      .where(eq(link.blocked, true))
      .orderBy(desc(link.blockedAt))
      .limit(5),
  ]);

  return { recentLinks, recentBlocked };
}

export async function searchLinks(ctx: ProtectedTRPCContext, input: SearchLinksInput) {
  const offset = (input.page - 1) * input.pageSize;
  const searchPattern = `%${input.query}%`;

  const [results, totalResult] = await Promise.all([
    ctx.db
      .select({
        id: link.id,
        url: link.url,
        alias: link.alias,
        domain: link.domain,
        blocked: link.blocked,
        blockedReason: link.blockedReason,
        createdAt: link.createdAt,
        userId: link.userId,
        userName: user.name,
        userEmail: user.email,
      })
      .from(link)
      .leftJoin(user, eq(link.userId, user.id))
      .where(
        or(
          like(link.url, searchPattern),
          like(link.alias, searchPattern),
          like(link.domain, searchPattern),
          like(user.email, searchPattern),
        ),
      )
      .orderBy(desc(link.createdAt))
      .limit(input.pageSize)
      .offset(offset),
    ctx.db
      .select({ count: count() })
      .from(link)
      .leftJoin(user, eq(link.userId, user.id))
      .where(
        or(
          like(link.url, searchPattern),
          like(link.alias, searchPattern),
          like(link.domain, searchPattern),
          like(user.email, searchPattern),
        ),
      ),
  ]);

  return {
    links: results,
    total: totalResult[0]?.count ?? 0,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function blockLink(ctx: ProtectedTRPCContext, input: BlockLinkInput) {
  const linkRecord = await ctx.db.query.link.findFirst({
    where: eq(link.id, input.linkId),
    columns: { id: true, alias: true, domain: true },
  });

  if (!linkRecord) {
    throw new Error("Link not found");
  }

  await ctx.db
    .update(link)
    .set({
      blocked: true,
      blockedAt: new Date(),
      blockedReason: input.reason,
    })
    .where(eq(link.id, input.linkId));

  // Invalidate cache so the blocked status takes effect immediately
  await deleteFromCache(buildCacheKey(linkRecord.domain, linkRecord.alias!));
}

export async function unblockLink(ctx: ProtectedTRPCContext, input: UnblockLinkInput) {
  const linkRecord = await ctx.db.query.link.findFirst({
    where: eq(link.id, input.linkId),
    columns: { id: true, alias: true, domain: true },
  });

  if (!linkRecord) {
    throw new Error("Link not found");
  }

  await ctx.db
    .update(link)
    .set({
      blocked: false,
      blockedAt: null,
      blockedReason: null,
    })
    .where(eq(link.id, input.linkId));

  await deleteFromCache(buildCacheKey(linkRecord.domain, linkRecord.alias!));
}

export async function searchUsers(ctx: ProtectedTRPCContext, input: SearchUsersInput) {
  const offset = (input.page - 1) * input.pageSize;
  const searchPattern = `%${input.query}%`;

  const [results, totalResult] = await Promise.all([
    ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        banned: user.banned,
        bannedReason: user.bannedReason,
        bannedAt: user.bannedAt,
        restrictedAt: user.restrictedAt,
        restrictedReason: user.restrictedReason,
        linkCount: sql<number>`(SELECT COUNT(*) FROM Link WHERE Link.userId = ${user.id})`,
      })
      .from(user)
      .where(or(like(user.email, searchPattern), like(user.name, searchPattern)))
      .orderBy(desc(user.createdAt))
      .limit(input.pageSize)
      .offset(offset),
    ctx.db
      .select({ count: count() })
      .from(user)
      .where(or(like(user.email, searchPattern), like(user.name, searchPattern))),
  ]);

  return {
    users: results,
    total: totalResult[0]?.count ?? 0,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function banUser(ctx: ProtectedTRPCContext, input: BanUserInput) {
  // Don't allow banning yourself
  if (input.userId === ctx.auth.userId) {
    throw new Error("Cannot ban yourself");
  }

  // Fetch links before transaction for cache invalidation
  const userLinks = await ctx.db
    .select({ id: link.id, alias: link.alias, domain: link.domain })
    .from(link)
    .where(eq(link.userId, input.userId));

  // Ban user + block all their links atomically
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        banned: true,
        bannedAt: new Date(),
        bannedReason: input.reason,
      })
      .where(eq(user.id, input.userId));

    if (userLinks.length > 0) {
      await tx
        .update(link)
        .set({
          blocked: true,
          blockedAt: new Date(),
          blockedReason: BAN_CASCADE_REASON,
        })
        // Restriction-blocked links keep their reason so unbanning a still
        // restricted account leaves them blocked.
        .where(
          and(
            eq(link.userId, input.userId),
            or(isNull(link.blockedReason), ne(link.blockedReason, RESTRICTED_LINK_REASON)),
          ),
        );
    }
  });

  // Invalidate cache after commit
  if (userLinks.length > 0) {
    await Promise.all(userLinks.map((l) => deleteFromCache(buildCacheKey(l.domain, l.alias!))));
  }
}

export async function unbanUser(ctx: ProtectedTRPCContext, input: UnbanUserInput) {
  // Fetch ban-cascaded links before transaction for cache invalidation
  const bannedLinks = await ctx.db
    .select({ id: link.id, alias: link.alias, domain: link.domain })
    .from(link)
    .where(and(eq(link.userId, input.userId), eq(link.blockedReason, BAN_CASCADE_REASON)));

  // Unban user + restore ban-cascaded links atomically
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({
        banned: false,
        bannedAt: null,
        bannedReason: null,
      })
      .where(eq(user.id, input.userId));

    if (bannedLinks.length > 0) {
      await tx
        .update(link)
        .set({
          blocked: false,
          blockedAt: null,
          blockedReason: null,
        })
        .where(and(eq(link.userId, input.userId), eq(link.blockedReason, BAN_CASCADE_REASON)));
    }
  });

  // Invalidate cache after commit
  if (bannedLinks.length > 0) {
    await Promise.all(bannedLinks.map((l) => deleteFromCache(buildCacheKey(l.domain, l.alias!))));
  }
}

/**
 * Restricts an account: it keeps sign-in and billing, but every content write
 * path refuses it (contentWriteProcedure, the v1 API). Its custom hostnames are
 * released from Cloudflare so its branded domains stop serving; the domain rows
 * and their links stay so lifting the restriction can bring them back.
 */
export async function restrictUser(ctx: ProtectedTRPCContext, input: RestrictUserInput) {
  if (input.userId === ctx.auth.userId) {
    throw new Error("Cannot restrict yourself");
  }

  await ctx.db
    .update(user)
    .set({ restrictedAt: new Date(), restrictedReason: input.reason })
    .where(eq(user.id, input.userId));

  const domains = await ctx.db
    .select({ domain: customDomain.domain })
    .from(customDomain)
    .where(eq(customDomain.userId, input.userId));
  const hostnames = [...new Set(domains.flatMap((d) => (d.domain ? [d.domain] : [])))];
  if (hostnames.length === 0) return { domainsReleased: 0, domainFailures: [] };

  // A hostname another account also claims (a shared team domain) stays live for them.
  const shared = await ctx.db
    .select({ domain: customDomain.domain })
    .from(customDomain)
    .where(and(inArray(customDomain.domain, hostnames), ne(customDomain.userId, input.userId)));
  const sharedSet = new Set(shared.map((d) => d.domain));
  const toRelease = hostnames.filter((hostname) => !sharedSet.has(hostname));

  // "pending", not "invalid": the cleanup cron deletes old invalid domains.
  // Rejected domains stay invalid so lifting the restriction doesn't revive them.
  await ctx.db
    .update(customDomain)
    .set({ status: "pending" })
    .where(and(eq(customDomain.userId, input.userId), notRejectedDomain));

  const results = await Promise.allSettled(
    toRelease.map(async (hostname) => {
      await deleteCustomHostname(hostname);

      // An apex on the www fallback serves through www.<apex>; release that too
      // and remember it so unrestricting re-adds only what existed.
      if (!isApexHostname(hostname)) return;
      const www = `www.${hostname}`;
      if (!(await getCustomHostname(www))) return;
      await deleteCustomHostname(www);
      await ctx.db
        .update(customDomain)
        .set({ wwwHostnameReleased: true })
        .where(and(eq(customDomain.userId, input.userId), eq(customDomain.domain, hostname)));
    }),
  );
  const domainFailures = toRelease.filter((_, i) => results[i]?.status === "rejected");
  if (domainFailures.length > 0) {
    log.error(
      { userId: input.userId, domains: domainFailures },
      "failed to release custom hostnames for restricted user",
    );
  }

  return { domainsReleased: toRelease.length - domainFailures.length, domainFailures };
}

export async function unrestrictUser(ctx: ProtectedTRPCContext, input: UnrestrictUserInput) {
  const [restrictedLinks, target] = await Promise.all([
    ctx.db
      .select({ alias: link.alias, domain: link.domain })
      .from(link)
      .where(and(eq(link.userId, input.userId), eq(link.blockedReason, RESTRICTED_LINK_REASON))),
    ctx.db.query.user.findFirst({ where: eq(user.id, input.userId), columns: { banned: true } }),
  ]);

  await ctx.db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ restrictedAt: null, restrictedReason: null })
      .where(eq(user.id, input.userId));

    if (restrictedLinks.length > 0) {
      // A banned account's links stay blocked, handed over to the ban so unbanning restores them.
      await tx
        .update(link)
        .set(
          target?.banned
            ? { blockedReason: BAN_CASCADE_REASON }
            : { blocked: false, blockedAt: null, blockedReason: null },
        )
        .where(and(eq(link.userId, input.userId), eq(link.blockedReason, RESTRICTED_LINK_REASON)));
    }
  });

  if (restrictedLinks.length > 0) {
    await Promise.all(
      restrictedLinks.map((l) => deleteFromCache(buildCacheKey(l.domain, l.alias!))),
    );
  }

  // Re-add the hostnames restricting released. Cloudflare re-validates them and
  // the domains page picks up the new status as it does for a new domain.
  const domains = await ctx.db
    .select({ domain: customDomain.domain, wwwReleased: customDomain.wwwHostnameReleased })
    .from(customDomain)
    .where(and(eq(customDomain.userId, input.userId), eq(customDomain.status, "pending")));
  const hostnames = [...new Set(domains.flatMap((d) => (d.domain ? [d.domain] : [])))];
  const wwwReleased = new Set(domains.filter((d) => d.wwwReleased).map((d) => d.domain));

  const results = await Promise.allSettled(
    hostnames.map(async (hostname) => {
      if (wwwReleased.has(hostname)) {
        await addCustomHostname(`www.${hostname}`);
        await ctx.db
          .update(customDomain)
          .set({ wwwHostnameReleased: false })
          .where(and(eq(customDomain.userId, input.userId), eq(customDomain.domain, hostname)));
      }

      const response = await addCustomHostname(hostname);
      const live = response.alreadyExists
        ? await getLiveCustomHostname(hostname)
        : response.hostname;
      if (!live) throw new Error(`No custom hostname for ${hostname}`);

      // Domains still held for review stay pending until approved
      await ctx.db
        .update(customDomain)
        .set({
          status: mapStatus(live),
          verificationDetails: buildVerificationChallenges(hostname, live),
        })
        .where(
          and(
            eq(customDomain.userId, input.userId),
            eq(customDomain.domain, hostname),
            domainCanGoLive,
          ),
        );
    }),
  );
  const domainFailures = hostnames.filter((_, i) => results[i]?.status === "rejected");
  if (domainFailures.length > 0) {
    log.error(
      { userId: input.userId, domains: domainFailures },
      "failed to restore custom hostnames for unrestricted user",
    );
  }

  return { domainsRestored: hostnames.length - domainFailures.length, domainFailures };
}

export async function getBlockedDomains(ctx: ProtectedTRPCContext) {
  return ctx.db.query.blockedDomain.findMany({
    orderBy: [desc(blockedDomain.createdAt)],
  });
}

export async function addBlockedDomain(ctx: ProtectedTRPCContext, input: AddBlockedDomainInput) {
  // Normalize: lowercase, strip protocol/path if a full URL was pasted
  let domain = input.domain.toLowerCase().trim();
  try {
    const parsed = new URL(domain.startsWith("http") ? domain : `https://${domain}`);
    domain = parsed.hostname;
  } catch {
    // Use as-is if not a valid URL
  }

  await ctx.db.insert(blockedDomain).values({
    domain,
    reason: input.reason ?? null,
    createdByUserId: ctx.auth.userId,
  });
}

export async function removeBlockedDomain(
  ctx: ProtectedTRPCContext,
  input: RemoveBlockedDomainInput,
) {
  await ctx.db.delete(blockedDomain).where(eq(blockedDomain.id, input.id));
}

// Held domains leave the queue once reviewed, so this only caps a backlog
const HELD_DOMAINS_LIMIT = 100;

export async function getHeldDomains(ctx: ProtectedTRPCContext, now: Date = new Date()) {
  const rows = await ctx.db
    .select({
      id: customDomain.id,
      domain: customDomain.domain,
      createdAt: customDomain.createdAt,
      reviewReason: customDomain.reviewReason,
      registeredAt: customDomain.registrableDomainRegisteredAt,
      registrar: customDomain.registrar,
      ownerId: customDomain.userId,
      ownerEmail: user.email,
      ownerCreatedAt: user.createdAt,
      subscription,
    })
    .from(customDomain)
    .leftJoin(user, eq(user.id, customDomain.userId))
    .leftJoin(subscription, eq(subscription.userId, customDomain.userId))
    .where(eq(customDomain.reviewStatus, "held"))
    .orderBy(desc(customDomain.createdAt))
    .limit(HELD_DOMAINS_LIMIT);

  return rows.map(({ subscription: sub, ...row }) => ({
    ...row,
    plan: resolvePlan(sub, now.getTime()),
  }));
}

const notHeldError = () =>
  new TRPCError({ code: "NOT_FOUND", message: "This domain is no longer held for review" });

async function findHeldDomain(ctx: ProtectedTRPCContext, id: number) {
  const record = await ctx.db.query.customDomain.findFirst({
    where: and(eq(customDomain.id, id), eq(customDomain.reviewStatus, "held")),
    columns: { id: true, domain: true },
  });
  if (!record?.domain) throw notHeldError();
  return { id: record.id, domain: record.domain };
}

/**
 * Releases the hold and resumes normal verification: the domain goes active
 * now if Cloudflare already validated it, otherwise the owner's status checks
 * and the reminder cron activate it once DNS is in place.
 */
export async function approveHeldDomain(
  ctx: ProtectedTRPCContext,
  input: ApproveHeldDomainInput,
  {
    lookupHostname = getLiveCustomHostname,
  }: { lookupHostname?: typeof getLiveCustomHostname } = {},
) {
  const record = await findHeldDomain(ctx, input.id);

  let active = false;
  try {
    active = await isHostnameActive(record.domain, await lookupHostname(record.domain));
  } catch (error) {
    // Approval still stands; the next status check picks the domain up
    log.warn({ err: error, domain: record.domain }, "status lookup failed while approving domain");
  }

  const status = active ? ("active" as const) : ("pending" as const);
  const [result] = await ctx.db
    .update(customDomain)
    .set({ reviewStatus: "approved", reviewedAt: new Date(), status })
    .where(and(eq(customDomain.id, record.id), eq(customDomain.reviewStatus, "held")));
  // Another admin decided first
  if (result.affectedRows === 0) throw notHeldError();

  return { status };
}

/**
 * Marks the domain invalid with the admin's reason and releases its Cloudflare
 * hostname, unless another workspace's claim on the same domain still uses it.
 */
export async function rejectHeldDomain(
  ctx: ProtectedTRPCContext,
  input: RejectHeldDomainInput,
  {
    removeHostname = deleteCustomHostname,
  }: { removeHostname?: (domain: string) => Promise<void> } = {},
) {
  const record = await findHeldDomain(ctx, input.id);

  const [result] = await ctx.db
    .update(customDomain)
    .set({
      status: "invalid",
      reviewStatus: "rejected",
      reviewReason: input.reason,
      reviewedAt: new Date(),
    })
    .where(and(eq(customDomain.id, record.id), eq(customDomain.reviewStatus, "held")));
  // Another admin decided first; an approved domain must keep its hostname
  if (result.affectedRows === 0) throw notHeldError();

  const otherClaim = await ctx.db.query.customDomain.findFirst({
    where: and(
      eq(customDomain.domain, record.domain),
      ne(customDomain.id, record.id),
      notRejectedDomain,
    ),
    columns: { id: true },
  });
  if (otherClaim) return { hostnameReleased: false };

  try {
    await removeHostname(record.domain);
    return { hostnameReleased: true };
  } catch (error) {
    log.error({ err: error, domain: record.domain }, "failed to release rejected domain hostname");
    return { hostnameReleased: false };
  }
}

export async function getFlaggedLinks(ctx: ProtectedTRPCContext, input: GetFlaggedLinksInput) {
  const offset = (input.page - 1) * input.pageSize;

  const whereConditions = input.status ? eq(flaggedLink.status, input.status) : undefined;

  const [results, totalResult] = await Promise.all([
    ctx.db
      .select({
        id: flaggedLink.id,
        linkId: flaggedLink.linkId,
        reason: flaggedLink.reason,
        reporterEmail: flaggedLink.reporterEmail,
        details: flaggedLink.details,
        status: flaggedLink.status,
        flaggedAt: flaggedLink.flaggedAt,
        resolvedAt: flaggedLink.resolvedAt,
        linkUrl: link.url,
        linkAlias: link.alias,
        linkDomain: link.domain,
        linkBlocked: link.blocked,
      })
      .from(flaggedLink)
      .leftJoin(link, eq(flaggedLink.linkId, link.id))
      .where(whereConditions)
      .orderBy(desc(flaggedLink.flaggedAt))
      .limit(input.pageSize)
      .offset(offset),
    ctx.db.select({ count: count() }).from(flaggedLink).where(whereConditions),
  ]);

  return {
    flaggedLinks: results,
    total: totalResult[0]?.count ?? 0,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function resolveFlaggedLink(
  ctx: ProtectedTRPCContext,
  input: ResolveFlaggedLinkInput,
) {
  const flagged = await ctx.db.query.flaggedLink.findFirst({
    where: eq(flaggedLink.id, input.id),
  });

  if (!flagged) {
    throw new Error("Flagged link not found");
  }

  await ctx.db
    .update(flaggedLink)
    .set({
      status: input.action,
      resolvedAt: new Date(),
      resolvedByUserId: ctx.auth.userId,
    })
    .where(eq(flaggedLink.id, input.id));

  // If the action is "blocked", also block the associated link
  if (input.action === "blocked") {
    await blockLink(ctx, {
      linkId: flagged.linkId,
      reason: flagged.reason ?? "Flagged and blocked by admin",
    });
  }
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/** Compute the previous period of the same length for comparison */
function getPreviousPeriod(from: Date, to: Date) {
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1); // 1ms before current "from"
  prevTo.setHours(23, 59, 59, 999);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  prevFrom.setHours(0, 0, 0, 0);
  return { prevFrom, prevTo };
}

/** Compute percentage change, returning null when the previous value is 0 */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

async function countClicks(ctx: ProtectedTRPCContext, from: Date, to: Date): Promise<number> {
  const result = await ctx.db
    .select({ total: count() })
    .from(linkVisit)
    .where(between(linkVisit.createdAt, from, to));
  return result[0]?.total ?? 0;
}

export async function getAnalytics(ctx: ProtectedTRPCContext, input: GetAnalyticsInput) {
  const { from, to } = input;
  const { prevFrom, prevTo } = getPreviousPeriod(from, to);

  const [linksInRange, usersInRange, clicksInRange, linksPrev, usersPrev, clicksPrev] =
    await Promise.all([
      ctx.db
        .select({ total: count() })
        .from(link)
        .where(between(link.createdAt, from, to)),
      ctx.db
        .select({ total: count() })
        .from(user)
        .where(between(user.createdAt, from, to)),
      countClicks(ctx, from, to),
      ctx.db
        .select({ total: count() })
        .from(link)
        .where(between(link.createdAt, prevFrom, prevTo)),
      ctx.db
        .select({ total: count() })
        .from(user)
        .where(between(user.createdAt, prevFrom, prevTo)),
      countClicks(ctx, prevFrom, prevTo),
    ]);

  const currentLinks = linksInRange[0]?.total ?? 0;
  const currentUsers = usersInRange[0]?.total ?? 0;
  const previousLinks = linksPrev[0]?.total ?? 0;
  const previousUsers = usersPrev[0]?.total ?? 0;

  return {
    links: currentLinks,
    users: currentUsers,
    clicks: clicksInRange,
    linksGrowth: pctChange(currentLinks, previousLinks),
    usersGrowth: pctChange(currentUsers, previousUsers),
    clicksGrowth: pctChange(clicksInRange, clicksPrev),
    avgLinksPerUser: currentUsers > 0 ? Math.round((currentLinks / currentUsers) * 10) / 10 : 0,
  };
}

export async function getActivityChart(ctx: ProtectedTRPCContext, input: GetActivityChartInput) {
  const { from, to, granularity } = input;

  const dateExpr =
    granularity === "month"
      ? sql<string>`DATE_FORMAT(${link.createdAt}, '%Y-%m')`
      : sql<string>`DATE(${link.createdAt})`;

  const userDateExpr =
    granularity === "month"
      ? sql<string>`DATE_FORMAT(${user.createdAt}, '%Y-%m')`
      : sql<string>`DATE(${user.createdAt})`;

  const clickDateExpr =
    granularity === "month"
      ? sql<string>`DATE_FORMAT(${linkVisit.createdAt}, '%Y-%m')`
      : sql<string>`DATE(${linkVisit.createdAt})`;

  const [dailyLinks, dailyUsers, dailyClicks] = await Promise.all([
    ctx.db
      .select({ date: dateExpr, count: count() })
      .from(link)
      .where(between(link.createdAt, from, to))
      .groupBy(dateExpr)
      .orderBy(dateExpr),
    ctx.db
      .select({ date: userDateExpr, count: count() })
      .from(user)
      .where(between(user.createdAt, from, to))
      .groupBy(userDateExpr)
      .orderBy(userDateExpr),
    ctx.db
      .select({ date: clickDateExpr, count: count() })
      .from(linkVisit)
      .where(between(linkVisit.createdAt, from, to))
      .groupBy(clickDateExpr)
      .orderBy(clickDateExpr),
  ]);

  const linksByDate = new Map(dailyLinks.map((l) => [String(l.date).split("T")[0], l.count]));
  const usersByDate = new Map(dailyUsers.map((u) => [String(u.date).split("T")[0], u.count]));
  const clicksByDate = new Map(dailyClicks.map((c) => [String(c.date).split("T")[0], c.count]));

  // Fill in all periods
  const result: {
    date: string;
    links: number;
    users: number;
    clicks: number;
  }[] = [];

  if (granularity === "month") {
    const cursor = new Date(from);
    cursor.setDate(1);
    const endMonth = to.getFullYear() * 12 + to.getMonth();
    while (cursor.getFullYear() * 12 + cursor.getMonth() <= endMonth) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      result.push({
        date: key,
        links: linksByDate.get(key) ?? 0,
        users: usersByDate.get(key) ?? 0,
        clicks: clicksByDate.get(key) ?? 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= to) {
      const key = cursor.toISOString().split("T")[0]!;
      result.push({
        date: key,
        links: linksByDate.get(key) ?? 0,
        users: usersByDate.get(key) ?? 0,
        clicks: clicksByDate.get(key) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return result;
}

export async function getTopUsers(ctx: ProtectedTRPCContext, input: GetTopUsersInput) {
  const { from, to, sortBy, limit: lim } = input;

  if (sortBy === "clicks") {
    // When ranking by clicks, filter on linkVisit.createdAt so clicks
    // are scoped to the selected window (not all-time).
    return ctx.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
        createdAt: user.createdAt,
        linkCount: sql<number>`COUNT(DISTINCT ${link.id})`,
        clickCount: sql<number>`COUNT(${linkVisit.id})`,
      })
      .from(user)
      .innerJoin(link, eq(link.userId, user.id))
      .innerJoin(linkVisit, eq(linkVisit.linkId, link.id))
      .where(between(linkVisit.createdAt, from, to))
      .groupBy(user.id)
      .orderBy(sql`COUNT(${linkVisit.id}) DESC`)
      .limit(lim);
  }

  // When ranking by links, filter on link.createdAt.
  return ctx.db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl,
      createdAt: user.createdAt,
      linkCount: sql<number>`COUNT(DISTINCT ${link.id})`,
      clickCount: sql<number>`SUM(CASE WHEN ${linkVisit.createdAt} BETWEEN ${from} AND ${to} THEN 1 ELSE 0 END)`,
    })
    .from(user)
    .innerJoin(link, eq(link.userId, user.id))
    .leftJoin(linkVisit, eq(linkVisit.linkId, link.id))
    .where(between(link.createdAt, from, to))
    .groupBy(user.id)
    .orderBy(sql`COUNT(DISTINCT ${link.id}) DESC`)
    .limit(lim);
}

export async function getTopLinks(ctx: ProtectedTRPCContext, input: GetTopLinksInput) {
  const { from, to, limit: lim } = input;

  return ctx.db
    .select({
      id: link.id,
      url: link.url,
      alias: link.alias,
      domain: link.domain,
      createdAt: link.createdAt,
      userEmail: user.email,
      clicks: count(linkVisit.id),
    })
    .from(linkVisit)
    .innerJoin(link, eq(linkVisit.linkId, link.id))
    .leftJoin(user, eq(link.userId, user.id))
    .where(between(linkVisit.createdAt, from, to))
    .groupBy(link.id)
    .orderBy(sql`COUNT(${linkVisit.id}) DESC`)
    .limit(lim);
}

export async function getPeakPeriods(ctx: ProtectedTRPCContext, input: GetPeakPeriodsInput) {
  const { from, to } = input;

  const [peakLinkDay, peakUserDay, peakClickDay, peakLinkMonth, peakUserMonth] = await Promise.all([
    ctx.db
      .select({
        date: sql<string>`DATE(${link.createdAt})`,
        count: count(),
      })
      .from(link)
      .where(between(link.createdAt, from, to))
      .groupBy(sql`DATE(${link.createdAt})`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(1),
    ctx.db
      .select({
        date: sql<string>`DATE(${user.createdAt})`,
        count: count(),
      })
      .from(user)
      .where(between(user.createdAt, from, to))
      .groupBy(sql`DATE(${user.createdAt})`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(1),
    ctx.db
      .select({
        date: sql<string>`DATE(${linkVisit.createdAt})`,
        count: count(),
      })
      .from(linkVisit)
      .where(between(linkVisit.createdAt, from, to))
      .groupBy(sql`DATE(${linkVisit.createdAt})`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(1),
    ctx.db
      .select({
        month: sql<string>`DATE_FORMAT(${link.createdAt}, '%Y-%m')`,
        count: count(),
      })
      .from(link)
      .where(between(link.createdAt, from, to))
      .groupBy(sql`DATE_FORMAT(${link.createdAt}, '%Y-%m')`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(1),
    ctx.db
      .select({
        month: sql<string>`DATE_FORMAT(${user.createdAt}, '%Y-%m')`,
        count: count(),
      })
      .from(user)
      .where(between(user.createdAt, from, to))
      .groupBy(sql`DATE_FORMAT(${user.createdAt}, '%Y-%m')`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(1),
  ]);

  return {
    peakLinkDay: peakLinkDay[0]
      ? { date: String(peakLinkDay[0].date).split("T")[0], count: peakLinkDay[0].count }
      : null,
    peakUserDay: peakUserDay[0]
      ? { date: String(peakUserDay[0].date).split("T")[0], count: peakUserDay[0].count }
      : null,
    peakClickDay: peakClickDay[0]
      ? { date: String(peakClickDay[0].date).split("T")[0], count: peakClickDay[0].count }
      : null,
    peakLinkMonth: peakLinkMonth[0] ?? null,
    peakUserMonth: peakUserMonth[0] ?? null,
  };
}

export async function getMonthlyBreakdown(
  ctx: ProtectedTRPCContext,
  input: GetMonthlyBreakdownInput,
) {
  const { from, to } = input;

  const [monthlyLinks, monthlyUsers, monthlyClicks] = await Promise.all([
    ctx.db
      .select({
        month: sql<string>`DATE_FORMAT(${link.createdAt}, '%Y-%m')`,
        count: count(),
      })
      .from(link)
      .where(between(link.createdAt, from, to))
      .groupBy(sql`DATE_FORMAT(${link.createdAt}, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(${link.createdAt}, '%Y-%m')`),
    ctx.db
      .select({
        month: sql<string>`DATE_FORMAT(${user.createdAt}, '%Y-%m')`,
        count: count(),
      })
      .from(user)
      .where(between(user.createdAt, from, to))
      .groupBy(sql`DATE_FORMAT(${user.createdAt}, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(${user.createdAt}, '%Y-%m')`),
    ctx.db
      .select({
        month: sql<string>`DATE_FORMAT(${linkVisit.createdAt}, '%Y-%m')`,
        count: count(),
      })
      .from(linkVisit)
      .where(between(linkVisit.createdAt, from, to))
      .groupBy(sql`DATE_FORMAT(${linkVisit.createdAt}, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(${linkVisit.createdAt}, '%Y-%m')`),
  ]);

  const linksByMonth = new Map(monthlyLinks.map((l) => [l.month, l.count]));
  const usersByMonth = new Map(monthlyUsers.map((u) => [u.month, u.count]));
  const clicksByMonth = new Map(monthlyClicks.map((c) => [c.month, c.count]));

  const result: {
    month: string;
    links: number;
    users: number;
    clicks: number;
  }[] = [];
  const cursor = new Date(from);
  cursor.setDate(1);
  const endMonth = to.getFullYear() * 12 + to.getMonth();
  while (cursor.getFullYear() * 12 + cursor.getMonth() <= endMonth) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    result.push({
      month: key,
      links: linksByMonth.get(key) ?? 0,
      users: usersByMonth.get(key) ?? 0,
      clicks: clicksByMonth.get(key) ?? 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

export async function getSystemHealth(ctx: ProtectedTRPCContext) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    linkStatsResult,
    userStatsResult,
    pendingFlaggedResult,
    openFeedbackResult,
    blockedDomainsResult,
    bioPageStatsResult,
    campaignStatsResult,
  ] = await Promise.all([
    ctx.db
      .select({
        total: count(),
        blocked: sql<number>`SUM(${link.blocked} = true)`,
      })
      .from(link),
    ctx.db
      .select({
        total: count(),
        banned: sql<number>`SUM(${user.banned} = true)`,
      })
      .from(user),
    ctx.db.select({ count: count() }).from(flaggedLink).where(eq(flaggedLink.status, "pending")),
    ctx.db.select({ count: count() }).from(feedback).where(eq(feedback.status, "open")),
    ctx.db.select({ count: count() }).from(blockedDomain),
    ctx.db
      .select({
        total: count(),
        today: sql<number>`SUM(${bioPage.createdAt} >= ${today})`,
      })
      .from(bioPage),
    ctx.db
      .select({
        total: count(),
        active: sql<number>`SUM(${campaign.status} = 'active')`,
        today: sql<number>`SUM(${campaign.createdAt} >= ${today})`,
      })
      .from(campaign),
  ]);

  const totalLinks = linkStatsResult[0]?.total ?? 0;
  const blockedLinks = linkStatsResult[0]?.blocked ?? 0;
  const totalUsers = userStatsResult[0]?.total ?? 0;
  const bannedUsers = userStatsResult[0]?.banned ?? 0;

  return {
    totalLinks,
    totalUsers,
    blockedLinks,
    bannedUsers,
    blockedPercent: totalLinks > 0 ? Math.round((blockedLinks / totalLinks) * 100 * 10) / 10 : 0,
    banRate: totalUsers > 0 ? Math.round((bannedUsers / totalUsers) * 100 * 10) / 10 : 0,
    pendingFlagged: pendingFlaggedResult[0]?.count ?? 0,
    openFeedback: openFeedbackResult[0]?.count ?? 0,
    blockedDomains: blockedDomainsResult[0]?.count ?? 0,
    totalBioPages: bioPageStatsResult[0]?.total ?? 0,
    bioPagesToday: Number(bioPageStatsResult[0]?.today ?? 0),
    totalCampaigns: campaignStatsResult[0]?.total ?? 0,
    activeCampaigns: Number(campaignStatsResult[0]?.active ?? 0),
    campaignsToday: Number(campaignStatsResult[0]?.today ?? 0),
  };
}

// ---------------------------------------------------------------------------
// User-base analytics (subscriptions)
// ---------------------------------------------------------------------------

/**
 * The webhook flips `subscription.plan` to "free" on cancel/expire, so
 * `plan IN ('pro','ultra')` already means "currently paying". There is no
 * historical event log, so churn-over-time is not derivable.
 */

function sharePct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export async function getUserBaseSummary(
  ctx: ProtectedTRPCContext,
  input: GetUserBaseSummaryInput,
) {
  const { from, to } = input;
  const { prevFrom, prevTo } = getPreviousPeriod(from, to);

  const [
    totalUsersResult,
    newUsersInRange,
    newUsersPrev,
    tierBreakdown,
    paidPrevResult,
    newPaidInRange,
    newPaidPrev,
  ] = await Promise.all([
    ctx.db.select({ total: count() }).from(user),
    ctx.db
      .select({ total: count() })
      .from(user)
      .where(between(user.createdAt, from, to)),
    ctx.db
      .select({ total: count() })
      .from(user)
      .where(between(user.createdAt, prevFrom, prevTo)),
    ctx.db
      .select({ plan: subscription.plan, total: count() })
      .from(subscription)
      .where(inArray(subscription.plan, PAID_PLANS))
      .groupBy(subscription.plan),
    // Best-effort "paid at prevTo": rows that existed by prevTo and are still paid today.
    ctx.db
      .select({ total: count() })
      .from(subscription)
      .where(
        and(inArray(subscription.plan, PAID_PLANS), sql`${subscription.createdAt} <= ${prevTo}`),
      ),
    ctx.db
      .select({ total: count() })
      .from(subscription)
      .where(
        and(inArray(subscription.plan, PAID_PLANS), between(subscription.createdAt, from, to)),
      ),
    ctx.db
      .select({ total: count() })
      .from(subscription)
      .where(
        and(
          inArray(subscription.plan, PAID_PLANS),
          between(subscription.createdAt, prevFrom, prevTo),
        ),
      ),
  ]);

  const totalUsers = totalUsersResult[0]?.total ?? 0;

  const tierMap = new Map<PaidPlan, number>();
  for (const row of tierBreakdown) {
    const paidPlan = PAID_PLANS.find((plan) => plan === row.plan);
    if (paidPlan) {
      tierMap.set(paidPlan, row.total);
    }
  }
  const proCount = tierMap.get("pro") ?? 0;
  const ultraCount = tierMap.get("ultra") ?? 0;
  const paidUsers = proCount + ultraCount;
  const freeUsers = totalUsers - paidUsers;

  const mrr = proCount * PLAN_PRICES_USD.pro + ultraCount * PLAN_PRICES_USD.ultra;

  return {
    totalUsers,
    freeUsers,
    paidUsers,
    paidPercent: sharePct(paidUsers, totalUsers),
    mrr,
    newUsers: newUsersInRange[0]?.total ?? 0,
    newUsersGrowth: pctChange(newUsersInRange[0]?.total ?? 0, newUsersPrev[0]?.total ?? 0),
    newPaid: newPaidInRange[0]?.total ?? 0,
    newPaidGrowth: pctChange(newPaidInRange[0]?.total ?? 0, newPaidPrev[0]?.total ?? 0),
    paidGrowth: pctChange(paidUsers, paidPrevResult[0]?.total ?? 0),
    tiers: {
      free: {
        count: freeUsers,
        share: sharePct(freeUsers, totalUsers),
        mrr: 0,
      },
      pro: {
        count: proCount,
        share: sharePct(proCount, totalUsers),
        mrr: proCount * PLAN_PRICES_USD.pro,
      },
      ultra: {
        count: ultraCount,
        share: sharePct(ultraCount, totalUsers),
        mrr: ultraCount * PLAN_PRICES_USD.ultra,
      },
    },
  };
}

export async function getSubscriptionTimeline(
  ctx: ProtectedTRPCContext,
  input: GetSubscriptionTimelineInput,
) {
  const { from, to } = input;

  const dateExpr = sql<string>`DATE_FORMAT(${subscription.createdAt}, '%Y-%m')`;

  const rows = await ctx.db
    .select({
      date: dateExpr,
      plan: subscription.plan,
      total: count(),
    })
    .from(subscription)
    .where(and(inArray(subscription.plan, PAID_PLANS), between(subscription.createdAt, from, to)))
    .groupBy(dateExpr, subscription.plan)
    .orderBy(dateExpr);

  const byDate = new Map<string, { pro: number; ultra: number }>();
  for (const row of rows) {
    const key = String(row.date);
    const entry = byDate.get(key) ?? { pro: 0, ultra: 0 };
    if (row.plan === "pro") entry.pro = row.total;
    else if (row.plan === "ultra") entry.ultra = row.total;
    byDate.set(key, entry);
  }

  const result: { date: string; pro: number; ultra: number }[] = [];
  const cursor = new Date(from);
  cursor.setDate(1);
  const endMonth = to.getFullYear() * 12 + to.getMonth();
  while (cursor.getFullYear() * 12 + cursor.getMonth() <= endMonth) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const entry = byDate.get(key) ?? { pro: 0, ultra: 0 };
    result.push({ date: key, pro: entry.pro, ultra: entry.ultra });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

export async function getRecentSubscriptions(
  ctx: ProtectedTRPCContext,
  input: GetRecentSubscriptionsInput,
) {
  const rows = await ctx.db
    .select({
      id: subscription.id,
      userId: subscription.userId,
      plan: subscription.plan,
      status: subscription.status,
      createdAt: subscription.createdAt,
      renewsAt: subscription.renewsAt,
      endsAt: subscription.endsAt,
      userName: user.name,
      userEmail: user.email,
      userImage: user.imageUrl,
    })
    .from(subscription)
    .innerJoin(user, eq(subscription.userId, user.id))
    .where(inArray(subscription.plan, PAID_PLANS))
    .orderBy(desc(subscription.createdAt))
    .limit(input.limit);

  return rows;
}

export const SIGNUP_WINDOW_DAYS = 90;
const SIGNUP_BREAKDOWN_LIMIT = 50;
// ponytail: distinct first-touch combinations in 90 days; raise if a breakdown
// ever looks short.
const SIGNUP_GROUP_LIMIT = 5000;

/**
 * Signups over the last 90 days (UTC days) by first-touch source, with paid
 * conversions: signups that later started a subscription (a Subscription row
 * exists, even if since cancelled).
 */
export async function getSignupAttribution(ctx: ProtectedTRPCContext, now: Date = new Date()) {
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = new Date(until.getTime() - (SIGNUP_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000);

  const dayExpr = sql<string>`DATE_FORMAT(${user.createdAt}, '%Y-%m-%d')`;
  const hasClickId = sql<number>`${userAttribution.clickId} IS NOT NULL`;
  const attributed = sql<number>`${userAttribution.userId} IS NOT NULL`;

  const [dayRows, groupRows] = await Promise.all([
    ctx.db
      .select({ date: dayExpr, signups: count(), paid: count(subscription.id) })
      .from(user)
      .leftJoin(subscription, eq(subscription.userId, user.id))
      .where(gte(user.createdAt, since))
      .groupBy(dayExpr),
    ctx.db
      .select({
        attributed,
        utmSource: userAttribution.utmSource,
        utmMedium: userAttribution.utmMedium,
        utmCampaign: userAttribution.utmCampaign,
        referrerHost: userAttribution.referrerHost,
        landingPath: userAttribution.landingPath,
        hasClickId,
        signups: count(),
        paid: count(subscription.id),
      })
      .from(user)
      .leftJoin(userAttribution, eq(userAttribution.userId, user.id))
      .leftJoin(subscription, eq(subscription.userId, user.id))
      .where(gte(user.createdAt, since))
      .groupBy(
        attributed,
        userAttribution.utmSource,
        userAttribution.utmMedium,
        userAttribution.utmCampaign,
        userAttribution.referrerHost,
        userAttribution.landingPath,
        hasClickId,
      )
      .orderBy(desc(count()))
      .limit(SIGNUP_GROUP_LIMIT),
  ]);

  const groups = groupRows.map((row) => ({
    ...row,
    attributed: Number(row.attributed) === 1,
    hasClickId: Number(row.hasClickId) === 1,
  }));

  return {
    since: since.toISOString().slice(0, 10),
    ...buildSignupSeries(
      dayRows.map((row) => ({ ...row, date: String(row.date) })),
      since,
      until,
    ),
    ...summarizeSignupGroups(groups, SIGNUP_BREAKDOWN_LIMIT),
  };
}

export const EMAIL_SUPPRESSION_RECENT_LIMIT = 50;

/** Active suppression counts by type, plus the most recent events (cleared ones included). */
export async function getEmailSuppressions(ctx: ProtectedTRPCContext) {
  const [countRows, recent] = await Promise.all([
    ctx.db
      .select({ type: emailSuppression.type, count: count() })
      .from(emailSuppression)
      .where(isNull(emailSuppression.clearedAt))
      .groupBy(emailSuppression.type),
    ctx.db
      .select({
        id: emailSuppression.id,
        email: emailSuppression.email,
        type: emailSuppression.type,
        detail: emailSuppression.detail,
        lastEventAt: emailSuppression.lastEventAt,
        clearedAt: emailSuppression.clearedAt,
        userId: emailSuppression.userId,
        userName: user.name,
      })
      .from(emailSuppression)
      .leftJoin(user, eq(user.id, emailSuppression.userId))
      .orderBy(desc(emailSuppression.lastEventAt), desc(emailSuppression.id))
      .limit(EMAIL_SUPPRESSION_RECENT_LIMIT),
  ]);

  const counts = { bounced: 0, complained: 0 };
  for (const row of countRows) counts[row.type] = Number(row.count);
  return { counts, recent };
}

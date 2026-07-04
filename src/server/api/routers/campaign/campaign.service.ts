import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import { canUseCampaignUtmDefaults } from "@/lib/billing/plans";
import { buildCacheKey, deleteFromCache } from "@/lib/core/cache";
import { campaign, folder, link, linkVisit, uniqueLinkVisit } from "@/server/db/schema";
import {
  getAccessibleFolderIds,
  isWorkspaceAdmin,
  requirePermission,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import {
  checkCampaignLimit,
  getCampaignDisplayState,
  mergeCampaignUtm,
  normalizeCampaignSlug,
  normalizeUtmValue,
  resolveRangeWindow,
  rethrowCampaignDuplicate,
  utmParamsEqual,
} from "./utils";

import type { SQL } from "drizzle-orm";
import type {
  AddLinksInput,
  CampaignAnalyticsInput,
  CreateCampaignInput,
  ListCampaignsInput,
  RemoveLinkInput,
  UpdateCampaignInput,
} from "./campaign.input";
import type { Campaign } from "@/server/db/schema";
import type { WorkspaceTRPCContext } from "../../trpc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWorkspaceCampaign(
  ctx: WorkspaceTRPCContext,
  id: number,
): Promise<Campaign> {
  const row = await ctx.db.query.campaign.findFirst({
    where: and(eq(campaign.id, id), workspaceFilter(ctx.workspace, campaign.userId, campaign.teamId)),
  });
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
  }
  return row;
}

/**
 * Folder-level access condition for non-admin team members: they may only
 * touch links in folders they can access (or unfoldered links). Returns
 * undefined for personal workspaces and team admins/owners.
 */
async function folderAccessCondition(ctx: WorkspaceTRPCContext): Promise<SQL | undefined> {
  if (ctx.workspace.type !== "team" || isWorkspaceAdmin(ctx.workspace)) return undefined;

  const allFolders = await ctx.db
    .select({ id: folder.id })
    .from(folder)
    .where(workspaceFilter(ctx.workspace, folder.userId, folder.teamId));
  const accessibleFolderIds = await getAccessibleFolderIds(
    ctx.db,
    ctx.workspace,
    allFolders.map((f) => f.id),
  );

  return accessibleFolderIds.length > 0
    ? or(inArray(link.folderId, accessibleFolderIds), isNull(link.folderId))
    : isNull(link.folderId);
}

/**
 * Conditions selecting a campaign's member links, honoring workspace scoping,
 * bio-link exclusion, and folder-level access restrictions for non-admin team
 * members (a campaign must not leak links from restricted folders).
 */
async function memberLinkConditions(
  ctx: WorkspaceTRPCContext,
  campaignId: number,
): Promise<SQL | undefined> {
  const condition = and(
    eq(link.campaignId, campaignId),
    workspaceFilter(ctx.workspace, link.userId, link.teamId),
    eq(link.isBioLink, false),
  );

  const folderCondition = await folderAccessCondition(ctx);
  return folderCondition ? and(condition, folderCondition) : condition;
}

async function assertNoDuplicate(
  ctx: WorkspaceTRPCContext,
  values: { name?: string; slug?: string },
  excludeId?: number,
): Promise<void> {
  const scope = workspaceFilter(ctx.workspace, campaign.userId, campaign.teamId);
  if (values.name) {
    const existing = await ctx.db.query.campaign.findFirst({
      where: and(scope, eq(campaign.name, values.name)),
    });
    if (existing && existing.id !== excludeId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A campaign with this name already exists in this workspace.",
      });
    }
  }
  if (values.slug) {
    const existing = await ctx.db.query.campaign.findFirst({
      where: and(scope, eq(campaign.slug, values.slug)),
    });
    if (existing && existing.id !== excludeId) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Another campaign already uses this slug. Reusing a utm_campaign value would mix their analytics.",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listCampaigns(ctx: WorkspaceTRPCContext, input: ListCampaignsInput) {
  let condition: SQL | undefined = workspaceFilter(
    ctx.workspace,
    campaign.userId,
    campaign.teamId,
  );
  if (input.status !== "all") {
    condition = and(condition, eq(campaign.status, input.status));
  }

  const rows = await ctx.db.query.campaign.findMany({
    where: condition,
    orderBy: desc(campaign.createdAt),
  });
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  // Same access model as getCampaign/analytics: non-admin team members must
  // not see counts/clicks from folders they can't access.
  const folderCondition = await folderAccessCondition(ctx);
  let memberScope = and(
    inArray(link.campaignId, ids),
    workspaceFilter(ctx.workspace, link.userId, link.teamId),
    eq(link.isBioLink, false),
  );
  if (folderCondition) {
    memberScope = and(memberScope, folderCondition);
  }
  const [memberCounts, clickCounts] = await Promise.all([
    ctx.db
      .select({ campaignId: link.campaignId, isQrCode: link.isQrCode, count: count() })
      .from(link)
      .where(memberScope)
      .groupBy(link.campaignId, link.isQrCode),
    ctx.db
      .select({ campaignId: link.campaignId, count: count() })
      .from(linkVisit)
      .innerJoin(link, eq(link.id, linkVisit.linkId))
      .where(memberScope)
      .groupBy(link.campaignId),
  ]);

  const linkCountMap = new Map<number, number>();
  const qrCountMap = new Map<number, number>();
  for (const row of memberCounts) {
    if (row.campaignId === null) continue;
    const target = row.isQrCode ? qrCountMap : linkCountMap;
    target.set(row.campaignId, Number(row.count));
  }
  const clickMap = new Map(
    clickCounts.filter((r) => r.campaignId !== null).map((r) => [r.campaignId!, Number(r.count)]),
  );

  return rows.map((row) => ({
    ...row,
    displayState: getCampaignDisplayState(row),
    linkCount: linkCountMap.get(row.id) ?? 0,
    qrCount: qrCountMap.get(row.id) ?? 0,
    totalClicks: clickMap.get(row.id) ?? 0,
  }));
}

/**
 * Lightweight name list for dropdowns (link form, list filter, add-to-campaign
 * modal) — a single indexed SELECT, no aggregate joins.
 */
export async function listCampaignNames(ctx: WorkspaceTRPCContext) {
  return ctx.db.query.campaign.findMany({
    where: and(
      workspaceFilter(ctx.workspace, campaign.userId, campaign.teamId),
      eq(campaign.status, "active"),
    ),
    orderBy: desc(campaign.createdAt),
    columns: {
      id: true,
      name: true,
      slug: true,
      utmSource: true,
      utmMedium: true,
      utmTerm: true,
      utmContent: true,
    },
  });
}

/**
 * Minimal attachable-link rows for the add-links picker: links plus
 * QR-backing links (never bio links), honoring folder restrictions. No visit
 * joins, no tag/creator hydration, and crucially no QR base64 image columns.
 */
export async function listLinkCandidates(ctx: WorkspaceTRPCContext) {
  const folderCondition = await folderAccessCondition(ctx);
  const scope = and(
    workspaceFilter(ctx.workspace, link.userId, link.teamId),
    eq(link.isBioLink, false),
    eq(link.archived, false),
  );

  const rows = await ctx.db.query.link.findMany({
    where: folderCondition ? and(scope, folderCondition) : scope,
    orderBy: desc(link.createdAt),
    limit: 500,
    columns: {
      id: true,
      name: true,
      alias: true,
      domain: true,
      isQrCode: true,
      campaignId: true,
    },
  });

  return rows;
}

export async function getCampaign(ctx: WorkspaceTRPCContext, id: number) {
  const row = await fetchWorkspaceCampaign(ctx, id);
  return assembleCampaign(ctx, row);
}

/** Slug-based lookup for the dashboard detail route (slugs are unique per workspace). */
export async function getCampaignBySlug(ctx: WorkspaceTRPCContext, slug: string) {
  const row = await ctx.db.query.campaign.findFirst({
    where: and(
      eq(campaign.slug, slug),
      workspaceFilter(ctx.workspace, campaign.userId, campaign.teamId),
    ),
  });
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
  }
  return assembleCampaign(ctx, row);
}

async function assembleCampaign(ctx: WorkspaceTRPCContext, row: Campaign) {
  const condition = await memberLinkConditions(ctx, row.id);
  const members = await ctx.db.query.link.findMany({
    where: condition,
    orderBy: desc(link.createdAt),
    columns: {
      id: true,
      name: true,
      alias: true,
      domain: true,
      url: true,
      isQrCode: true,
      archived: true,
      utmParams: true,
      createdAt: true,
    },
  });

  const memberIds = members.map((m) => m.id);
  const clickRows = memberIds.length
    ? await ctx.db
        .select({ linkId: linkVisit.linkId, count: count() })
        .from(linkVisit)
        .where(inArray(linkVisit.linkId, memberIds))
        .groupBy(linkVisit.linkId)
    : [];
  const clickMap = new Map(clickRows.map((r) => [r.linkId, Number(r.count)]));

  return {
    ...row,
    displayState: getCampaignDisplayState(row),
    canUseUtmDefaults: canUseCampaignUtmDefaults(ctx.workspace.plan),
    links: members.map((member) => ({
      ...member,
      clicks: clickMap.get(member.id) ?? 0,
    })),
  };
}

export async function createCampaign(ctx: WorkspaceTRPCContext, input: CreateCampaignInput) {
  requirePermission(ctx.workspace, "campaigns.create", "create campaigns");
  await checkCampaignLimit(ctx);

  const slug = normalizeCampaignSlug(input.slug ?? input.name);
  if (!slug) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The campaign slug must contain letters or numbers.",
    });
  }

  await assertNoDuplicate(ctx, { name: input.name, slug });

  const ownership = workspaceOwnership(ctx.workspace);
  try {
    const [result] = await ctx.db.insert(campaign).values({
      name: input.name,
      slug,
      description: input.description,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      userId: ownership.userId,
      teamId: ownership.teamId,
      createdByUserId: ctx.auth.userId,
    });

    return { id: Number(result.insertId), slug };
  } catch (error) {
    rethrowCampaignDuplicate(error);
  }
}

export async function updateCampaign(ctx: WorkspaceTRPCContext, input: UpdateCampaignInput) {
  requirePermission(ctx.workspace, "campaigns.edit", "edit campaigns");
  const existing = await fetchWorkspaceCampaign(ctx, input.id);

  // Unarchiving takes a slot again, so it re-checks the active-campaign cap.
  if (input.status === "active" && existing.status === "archived") {
    await checkCampaignLimit(ctx);
  }

  const utmInputs = {
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmTerm: input.utmTerm,
    utmContent: input.utmContent,
  };
  // Any explicit UTM key (including clearing one) is a Pro+ operation.
  const touchesUtm = Object.values(utmInputs).some((value) => value !== undefined);
  if (touchesUtm && !canUseCampaignUtmDefaults(ctx.workspace.plan)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Campaign UTM defaults are available on Pro and Ultra. Upgrade to use them.",
    });
  }

  const slug = input.slug !== undefined ? normalizeCampaignSlug(input.slug) : undefined;
  if (slug === "") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The campaign slug must contain letters or numbers.",
    });
  }

  await assertNoDuplicate(
    ctx,
    {
      name: input.name !== undefined && input.name !== existing.name ? input.name : undefined,
      slug: slug !== undefined && slug !== existing.slug ? slug : undefined,
    },
    existing.id,
  );

  try {
    await ctx.db
      .update(campaign)
      .set({
        name: input.name,
        slug,
        description: input.description,
        status: input.status,
        startDate: input.startDate,
        endDate: input.endDate,
        utmSource: input.utmSource !== undefined ? normalizeUtmValue(input.utmSource) : undefined,
        utmMedium: input.utmMedium !== undefined ? normalizeUtmValue(input.utmMedium) : undefined,
        utmTerm: input.utmTerm !== undefined ? normalizeUtmValue(input.utmTerm) : undefined,
        utmContent: input.utmContent !== undefined ? normalizeUtmValue(input.utmContent) : undefined,
      })
      .where(eq(campaign.id, existing.id));
  } catch (error) {
    rethrowCampaignDuplicate(error);
  }

  // Return the final slug so the client can redirect the slug-based route
  // after a rename.
  return { id: existing.id, slug: slug ?? existing.slug };
}

export async function deleteCampaign(ctx: WorkspaceTRPCContext, id: number) {
  requirePermission(ctx.workspace, "campaigns.delete", "delete campaigns");
  const existing = await fetchWorkspaceCampaign(ctx, id);

  // Hard delete with manual cascade (no DB FKs): members are detached, not
  // deleted — links and their analytics survive the campaign.
  await ctx.db.transaction(async (tx) => {
    await tx.update(link).set({ campaignId: null }).where(eq(link.campaignId, existing.id));
    await tx.delete(campaign).where(eq(campaign.id, existing.id));
  });

  return { id: existing.id };
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export async function addLinks(ctx: WorkspaceTRPCContext, input: AddLinksInput) {
  requirePermission(ctx.workspace, "campaigns.edit", "edit campaigns");
  const row = await fetchWorkspaceCampaign(ctx, input.id);

  // Dropdowns only offer active campaigns, but guard against stale clients.
  if (row.status === "archived") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This campaign is archived. Restore it before adding links.",
    });
  }

  if (input.applyUtmDefaults && !canUseCampaignUtmDefaults(ctx.workspace.plan)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Campaign UTM defaults are available on Pro and Ultra. Upgrade to use them.",
    });
  }

  // Only real workspace links can join; hidden bio-backing links never can,
  // and non-admin team members can't pull in links from restricted folders.
  const folderCondition = await folderAccessCondition(ctx);
  const candidateScope = and(
    inArray(link.id, input.linkIds),
    workspaceFilter(ctx.workspace, link.userId, link.teamId),
    eq(link.isBioLink, false),
  );
  const candidates = await ctx.db.query.link.findMany({
    where: folderCondition ? and(candidateScope, folderCondition) : candidateScope,
    columns: { id: true, alias: true, domain: true, utmParams: true },
  });
  if (candidates.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No eligible links to add." });
  }

  await ctx.db
    .update(link)
    .set({ campaignId: row.id })
    .where(inArray(link.id, candidates.map((c) => c.id)));

  if (input.applyUtmDefaults) {
    // Stamp only links whose params actually change; rows are disjoint so the
    // updates (and hot-path cache purges) can run concurrently.
    await Promise.all(
      candidates.map(async (candidate) => {
        const merged = mergeCampaignUtm(row, candidate.utmParams);
        if (!merged || utmParamsEqual(merged, candidate.utmParams)) return;
        await ctx.db.update(link).set({ utmParams: merged }).where(eq(link.id, candidate.id));
        if (candidate.alias) {
          await deleteFromCache(buildCacheKey(candidate.domain, candidate.alias));
        }
      }),
    );
  }

  return { added: candidates.length };
}

export async function removeLink(ctx: WorkspaceTRPCContext, input: RemoveLinkInput) {
  requirePermission(ctx.workspace, "campaigns.edit", "edit campaigns");
  await fetchWorkspaceCampaign(ctx, input.id);

  const folderCondition = await folderAccessCondition(ctx);
  const scope = and(
    eq(link.id, input.linkId),
    eq(link.campaignId, input.id),
    workspaceFilter(ctx.workspace, link.userId, link.teamId),
  );

  await ctx.db
    .update(link)
    .set({ campaignId: null })
    .where(folderCondition ? and(scope, folderCondition) : scope);

  return { removed: input.linkId };
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

const BREAKDOWN_LIMIT = 10;

export async function getCampaignAnalytics(
  ctx: WorkspaceTRPCContext,
  input: CampaignAnalyticsInput,
) {
  const row = await fetchWorkspaceCampaign(ctx, input.id);
  const plan = ctx.workspace.plan;
  const isProPlan = plan !== "free";

  // Free analytics are clamped to the trailing week (existing convention).
  const range = !isProPlan && !["24h", "7d"].includes(input.range) ? "7d" : input.range;
  const { start, end } = resolveRangeWindow(range);
  const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime()));

  const condition = await memberLinkConditions(ctx, row.id);
  const members = await ctx.db.query.link.findMany({
    where: condition,
    columns: {
      id: true,
      name: true,
      alias: true,
      domain: true,
      url: true,
      isQrCode: true,
      utmParams: true,
    },
  });

  const emptyPayload = {
    totals: { clicks: 0, scans: 0, engagements: 0, uniqueVisitors: 0, prevEngagements: 0 },
    series: [] as { date: string; clicks: number; scans: number }[],
    links: [] as {
      id: number;
      name: string | null;
      alias: string | null;
      domain: string;
      url: string | null;
      isQrCode: boolean | null;
      clicks: number;
      share: number;
    }[],
    channels: {} as Record<string, number>,
    countries: {} as Record<string, number>,
    devices: {} as Record<string, number>,
    referrers: {} as Record<string, number>,
    range,
    isProPlan,
  };
  if (members.length === 0) return emptyPayload;

  const memberIds = members.map((m) => m.id);
  const inWindow = and(
    inArray(linkVisit.linkId, memberIds),
    gte(linkVisit.createdAt, start),
    lte(linkVisit.createdAt, end),
  );

  const [
    clicksByType,
    prevTotal,
    uniqueVisitors,
    seriesRows,
    perLinkRows,
    countryRows,
    deviceRows,
    refererRows,
  ] = await Promise.all([
    ctx.db
      .select({ isQrCode: link.isQrCode, count: count() })
      .from(linkVisit)
      .innerJoin(link, eq(link.id, linkVisit.linkId))
      .where(inWindow)
      .groupBy(link.isQrCode),
    ctx.db
      .select({ count: count() })
      .from(linkVisit)
      .where(
        and(
          inArray(linkVisit.linkId, memberIds),
          gte(linkVisit.createdAt, prevStart),
          lt(linkVisit.createdAt, start),
        ),
      ),
    ctx.db
      .select({ count: sql<number>`COUNT(DISTINCT ${uniqueLinkVisit.ipHash})` })
      .from(uniqueLinkVisit)
      .where(
        and(
          inArray(uniqueLinkVisit.linkId, memberIds),
          gte(uniqueLinkVisit.createdAt, start),
          lte(uniqueLinkVisit.createdAt, end),
        ),
      ),
    ctx.db
      .select({
        date: sql<string>`DATE(${linkVisit.createdAt})`,
        isQrCode: link.isQrCode,
        count: count(),
      })
      .from(linkVisit)
      .innerJoin(link, eq(link.id, linkVisit.linkId))
      .where(inWindow)
      .groupBy(sql`DATE(${linkVisit.createdAt})`, link.isQrCode),
    ctx.db
      .select({ linkId: linkVisit.linkId, count: count() })
      .from(linkVisit)
      .where(inWindow)
      .groupBy(linkVisit.linkId),
    ctx.db
      .select({ value: linkVisit.country, count: count() })
      .from(linkVisit)
      .where(inWindow)
      .groupBy(linkVisit.country)
      .orderBy(desc(count()))
      .limit(BREAKDOWN_LIMIT),
    ctx.db
      .select({ value: linkVisit.device, count: count() })
      .from(linkVisit)
      .where(inWindow)
      .groupBy(linkVisit.device)
      .orderBy(desc(count()))
      .limit(BREAKDOWN_LIMIT),
    ctx.db
      .select({ value: linkVisit.referer, count: count() })
      .from(linkVisit)
      .where(inWindow)
      .groupBy(linkVisit.referer)
      .orderBy(desc(count()))
      .limit(BREAKDOWN_LIMIT),
  ]);

  let clicks = 0;
  let scans = 0;
  for (const typeRow of clicksByType) {
    if (typeRow.isQrCode) scans += Number(typeRow.count);
    else clicks += Number(typeRow.count);
  }
  const engagements = clicks + scans;

  const seriesMap = new Map<string, { date: string; clicks: number; scans: number }>();
  for (const seriesRow of seriesRows) {
    const entry = seriesMap.get(seriesRow.date) ?? { date: seriesRow.date, clicks: 0, scans: 0 };
    if (seriesRow.isQrCode) entry.scans += Number(seriesRow.count);
    else entry.clicks += Number(seriesRow.count);
    seriesMap.set(seriesRow.date, entry);
  }
  const series = [...seriesMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  const perLinkMap = new Map(perLinkRows.map((r) => [r.linkId, Number(r.count)]));
  const links = members
    .map((member) => {
      const memberClicks = perLinkMap.get(member.id) ?? 0;
      return {
        id: member.id,
        name: member.name,
        alias: member.alias,
        domain: member.domain,
        url: member.url,
        isQrCode: member.isQrCode,
        clicks: memberClicks,
        share: engagements > 0 ? memberClicks / engagements : 0,
      };
    })
    .sort((a, b) => b.clicks - a.clicks);

  // Channel rollup: member links grouped by their utm_source. Kept in JS —
  // member counts are small and utmParams is a JSON column.
  const channels: Record<string, number> = {};
  for (const member of members) {
    const source = member.utmParams?.utm_source?.trim();
    const key = member.isQrCode ? "qr" : source && source !== "" ? source : "untagged";
    channels[key] = (channels[key] ?? 0) + (perLinkMap.get(member.id) ?? 0);
  }

  const toRecord = (rows: { value: string | null; count: number }[]): Record<string, number> => {
    const record: Record<string, number> = {};
    for (const entry of rows) {
      record[entry.value && entry.value !== "" ? entry.value : "Unknown"] = Number(entry.count);
    }
    return record;
  };

  return {
    totals: {
      clicks,
      scans,
      engagements,
      uniqueVisitors: Number(uniqueVisitors[0]?.count ?? 0),
      prevEngagements: Number(prevTotal[0]?.count ?? 0),
    },
    series,
    links,
    channels,
    countries: toRecord(countryRows),
    devices: toRecord(deviceRows),
    referrers: toRecord(refererRows),
    range,
    isProPlan,
  };
}

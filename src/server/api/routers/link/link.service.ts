import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNull,
  like,
  lt,
  lte,
  or,
  sql,
  sum,
} from "drizzle-orm";
import { z } from "zod";

import {
  canUseCampaignUtmDefaults,
  canUseGeoRules,
  getGeoRulesLimit,
  isUnlimitedGeoRules,
} from "@/lib/billing/plans";
import { DEFAULT_PLATFORM_DOMAIN, isPlatformDomain } from "@/lib/constants/domains";
import {
  bucketKey,
  freeAnalyticsWindowStart,
  resolveAnalyticsRange,
  resolveRangeWindow,
  summarizeArchived,
} from "@/lib/core/analytics";
import { groupReferrers } from "@/lib/core/analytics/referrer";
import { parseDeviceDetails } from "@/lib/core/analytics/visitor";
import {
  buildCacheKey,
  deleteFromCache,
  deleteGeoRulesFromCache,
  getStringFromCache,
  setInCache,
  setStringInCache,
} from "@/lib/core/cache";
import { matchTargetingRules } from "@/lib/core/geo-rules/matcher";
import { logger } from "@/lib/logger";
import { getClientIp, getRequestGeo } from "@/lib/platform";
import { normalizeAlias } from "@/lib/utils";
import { runBackgroundTask } from "@/lib/utils/background";
import { INVALID_URL_MESSAGE, normalizeDestinationUrl } from "@/lib/utils/destination-url";
import { hashIp } from "@/lib/utils/ip-hash";
import { displayName } from "@/lib/utils/user-name";
import { recordClick, resolveLink } from "@/middlewares/record-click";
import { checkLinkExpiration, isLinkScheduled } from "@/middlewares/resolve-link";
import {
  campaign,
  folder,
  geoRule,
  link,
  linkMilestone,
  linkTag,
  linkVisit,
  linkVisitDailySummary,
  qrcode,
  tag,
  uniqueLinkVisit,
  user,
} from "@/server/db/schema";
import { previousAddressCacheKeys, recordAddressChange } from "@/server/lib/link-address";
import {
  classifyLinkCreationError,
  recordLinkCreationFailures,
  trackLinkCreation,
} from "@/server/lib/link-creation/failures";
import { scrapeMetadata } from "@/server/lib/metadata";
import { assertUrlSafe } from "@/server/lib/phishing";
import { recordSafetyFollowUp, workspaceSafetyAccount } from "@/server/lib/phishing/follow-up";
import {
  checkCampaignPatternsAfterResponse,
  type LinkDestination,
} from "@/server/lib/phishing/rescan";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";
import { generateUnreservedAlias, reserveLinkAliases } from "@/server/lib/reserved-alias";
import { assertValidImageInput, deleteImage, uploadImage } from "@/server/lib/storage";
import {
  assertCanEnableVerifiedClicks,
  issueVerifiedClickToken,
} from "@/server/lib/verified-click";
import {
  getAccessibleFolderIds,
  isWorkspaceAdmin,
  requireFolderAccess,
  workspaceFilter,
  workspaceOwnership,
  workspaceUsagePlan,
} from "@/server/lib/workspace";

import { mergeCampaignUtm } from "../campaign/utils";
import { associateTagsWithLink, getTagsForLink } from "../tag/tag.service";
import { LINK_ALIAS_MAX_LENGTH, LINK_NOTE_MAX_LENGTH } from "./link.input";
import {
  assertDomainAllowed,
  assertDomainOwned,
  assertDomainWithinPlan,
  BITLY_DOMAINS,
  checkWorkspaceLinkLimit,
  CUSTOM_DOMAIN_IMPORT_ALLOWANCE,
  escapeLikePattern,
  getWorkspaceDefaultDomain,
  hasUtmValues,
  incrementCustomDomainImportCount,
  incrementWorkspaceLinkCount,
  overviewLinkConditions,
  parseLinkCsv,
  PASSWORD_ATTEMPTS_PER_IP,
  PASSWORD_ATTEMPTS_PER_LINK,
  readAttemptWindow,
  recordFailedAttempt,
  restrictedLinkValues,
  toPlanAllowedDomain,
  sameGeoRules,
  sameUtmParams,
  settleWithConcurrency,
  toPublicLink,
  checkAliasAvailability as assertAliasAvailable,
  validateAlias,
} from "./utils";

import type { PublicTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type {
  AllAnalyticsInput,
  BulkArchiveLinksInput,
  BulkToggleLinkStatusInput,
  CreateLinkInput,
  GetLinkInput,
  LinkVisitsInput,
  ListLinksInput,
  QuickLinkShorteningInput,
  RetrieveOriginalUrlInput,
  ToggleArchiveInput,
  UpdateLinkInput,
  VerifyLinkPasswordInput,
} from "./link.input";
import type { CsvLinkRow } from "./utils";
import type { Plan } from "@/lib/billing/plans";
import type { Link } from "@/server/db/schema";
import type { LinkCreationAttempt, LinkCreationStep } from "@/server/lib/link-creation/failures";
import type { ScrapedMetadata } from "@/server/lib/metadata";
import type { UrlSafetyResult } from "@/server/lib/phishing";
import type { WorkspaceContext } from "@/server/lib/workspace";

const log = logger.child({ component: "link.service" });

const storedLinkMetadataSchema = z.object({ image: z.string().optional() }).nullable();

/** OG image URL persisted in a link's JSON metadata, if any. */
function storedOgImage(metadata: Link["metadata"]): string | undefined {
  const parsed = storedLinkMetadataSchema.safeParse(metadata);
  return parsed.success ? parsed.data?.image : undefined;
}

export const getLinks = async (ctx: WorkspaceTRPCContext, input: ListLinksInput) => {
  const {
    page,
    pageSize,
    orderBy,
    orderDirection,
    tag: tagName,
    campaignId,
    archivedFilter,
    search,
  } = input;
  const orderFunc = orderDirection === "desc" ? desc : asc;

  // If filtering by tag, first get the link IDs that have this tag
  let linkIdsWithTag: number[] = [];
  if (tagName && tagName.trim() !== "") {
    // Get tag record - use workspace filtering for tags
    const tagRecord = await ctx.db.query.tag.findFirst({
      where: and(
        eq(tag.name, tagName.trim().toLowerCase()),
        workspaceFilter(ctx.workspace, tag.userId, tag.teamId),
      ),
    });

    if (tagRecord) {
      // Get link IDs associated with this tag
      const linkTagRecords = await ctx.db
        .select({ linkId: linkTag.linkId })
        .from(linkTag)
        .where(eq(linkTag.tagId, tagRecord.id));

      linkIdsWithTag = linkTagRecords.map((record) => record.linkId);
    }
  }

  // Base query condition - use workspace filtering, exclude QR- and bio-backing links
  let baseCondition = and(
    workspaceFilter(ctx.workspace, link.userId, link.teamId),
    eq(link.isQrCode, false),
    eq(link.isBioLink, false),
  );

  // Add tag filtering if needed
  if (tagName && tagName.trim() !== "" && linkIdsWithTag.length > 0) {
    baseCondition = and(baseCondition, inArray(link.id, linkIdsWithTag));
  } else if (tagName && tagName.trim() !== "" && linkIdsWithTag.length === 0) {
    // No links with this tag, return empty results
    return {
      links: [],
      totalLinks: 0,
      totalClicks: 0,
      currentPage: page,
      totalPages: 0,
      // Only read when no filter is active; a tag filter is.
      workspaceHasLinks: true,
    };
  }

  if (campaignId !== undefined) {
    baseCondition = and(baseCondition, eq(link.campaignId, campaignId));
  }

  // Add archived filtering
  if (archivedFilter === "archived") {
    baseCondition = and(baseCondition, eq(link.archived, true));
  } else if (archivedFilter === "active" || !archivedFilter) {
    // Default to showing active links
    baseCondition = and(baseCondition, eq(link.archived, false));
  }
  // If archivedFilter is 'all', no additional condition is added

  // Add search filtering
  if (search && search.trim() !== "") {
    const searchLower = `%${escapeLikePattern(search.trim().toLowerCase())}%`;
    baseCondition = and(
      baseCondition,
      or(like(link.name, searchLower), like(link.alias, searchLower), like(link.url, searchLower)),
    );
  }

  // Add folder access filtering for team members (non-admin/owner)
  // - Show links from accessible folders
  // - Show links with no folder (folderId = null) - always visible to all team members
  if (ctx.workspace.type === "team" && !isWorkspaceAdmin(ctx.workspace)) {
    // Get all folders in the team workspace
    const allFolders = await ctx.db
      .select({ id: folder.id })
      .from(folder)
      .where(workspaceFilter(ctx.workspace, folder.userId, folder.teamId));

    const folderIds = allFolders.map((f) => f.id);
    const accessibleFolderIds = await getAccessibleFolderIds(ctx.db, ctx.workspace, folderIds);

    // Filter: links in accessible folders OR links with no folder
    if (accessibleFolderIds.length > 0) {
      baseCondition = and(
        baseCondition,
        or(inArray(link.folderId, accessibleFolderIds), isNull(link.folderId)),
      );
    } else {
      // No accessible folders - only show unfoldered links
      baseCondition = and(baseCondition, isNull(link.folderId));
    }
  }

  // Archived clicks rolled up by the analytics cleanup job — raw LinkVisit
  // rows older than the retention window are deleted, so true totals must
  // combine both sources (see LinkVisitDailySummary).
  const archivedClicksPerLink = ctx.db
    .select({
      linkId: linkVisitDailySummary.linkId,
      clicks: sum(linkVisitDailySummary.clicks).as("archived_clicks"),
    })
    .from(linkVisitDailySummary)
    .groupBy(linkVisitDailySummary.linkId)
    .as("archivedClicksPerLink");

  // Prepare the query parts
  const linksQuery = ctx.db
    .select({
      ...getTableColumns(link),
      totalClicks:
        sql<number>`${count(linkVisit.id)} + COALESCE(MAX(${archivedClicksPerLink.clicks}), 0)`
          .mapWith(Number)
          .as("total_clicks"),
    })
    .from(link)
    .leftJoin(linkVisit, eq(link.id, linkVisit.linkId))
    .leftJoin(archivedClicksPerLink, eq(link.id, archivedClicksPerLink.linkId))
    .where(baseCondition)
    .groupBy(link.id)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Apply ordering based on the orderBy parameter
  if (orderBy === "totalClicks") {
    linksQuery.orderBy(orderFunc(sql`total_clicks`));
  } else if (orderBy === "lastClicked") {
    linksQuery.orderBy(orderFunc(sql`MAX(${linkVisit.createdAt})`));
  } else {
    linksQuery.orderBy(orderFunc(link.createdAt));
  }

  const workspaceLinkCondition = and(
    workspaceFilter(ctx.workspace, link.userId, link.teamId),
    eq(link.isQrCode, false),
    eq(link.isBioLink, false),
  );

  const [totalLinksResult, totalClicksResult, archivedClicksResult, links] = await Promise.all([
    ctx.db.select({ count: count() }).from(link).where(baseCondition),
    ctx.db
      .select({ totalClicks: count(linkVisit.id) })
      .from(linkVisit)
      .innerJoin(link, eq(link.id, linkVisit.linkId))
      .where(workspaceLinkCondition),
    ctx.db
      .select({ archivedClicks: sum(linkVisitDailySummary.clicks) })
      .from(linkVisitDailySummary)
      .innerJoin(link, eq(link.id, linkVisitDailySummary.linkId))
      .where(workspaceLinkCondition),
    linksQuery,
  ]);

  // Batch fetch creator info for team workspaces (avoid N+1)
  let creatorMap: Map<string, { id: string; name: string | null; imageUrl: string | null }> =
    new Map();
  if (ctx.workspace.type === "team") {
    const creatorIds = [
      ...new Set(links.map((l) => l.createdByUserId).filter((id): id is string => !!id)),
    ];
    if (creatorIds.length > 0) {
      const creators = await ctx.db.query.user.findMany({
        where: inArray(user.id, creatorIds),
        columns: {
          id: true,
          name: true,
          imageUrl: true,
        },
      });
      creatorMap = new Map(creators.map((c) => [c.id, { ...c, name: displayName(c.name) }]));
    }
  }

  // Fetch tags and folder for each link
  const linksWithTags = await Promise.all(
    links.map(async (linkItem) => {
      const tagRecords = await getTagsForLink(ctx, linkItem.id);

      // Fetch folder if linkItem has a folderId
      let folderInfo = null;
      if (linkItem.folderId) {
        folderInfo = await ctx.db.query.folder.findFirst({
          where: (table, { eq }) => eq(table.id, linkItem.folderId!),
          columns: {
            id: true,
            name: true,
          },
        });
      }

      // Get creator from pre-fetched map
      const createdBy = linkItem.createdByUserId
        ? (creatorMap.get(linkItem.createdByUserId) ?? null)
        : null;

      return {
        ...linkItem,
        tags: tagRecords.map((tagRecord) => tagRecord.name),
        folder: folderInfo,
        createdBy,
      };
    }),
  );

  const totalLinks = totalLinksResult?.[0]?.count ?? 0;
  // Tells a brand-new workspace (first-link prompt) apart from a filter that
  // matched nothing; only queried when this page came back empty.
  const workspaceHasLinks =
    totalLinks > 0 ||
    (await ctx.db.select({ id: link.id }).from(link).where(workspaceLinkCondition).limit(1))
      .length > 0;
  const totalClicks =
    (totalClicksResult?.[0]?.totalClicks ?? 0) +
    (Number(archivedClicksResult?.[0]?.archivedClicks) || 0);

  return {
    links: linksWithTags,
    totalLinks,
    totalClicks,
    currentPage: page,
    totalPages: Math.ceil(totalLinks / pageSize),
    workspaceHasLinks,
  };
};

export const getLink = async (ctx: WorkspaceTRPCContext, input: GetLinkInput) => {
  const linkData = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  // Check folder access permission for team members
  if (linkData?.folderId) {
    await requireFolderAccess(ctx.db, ctx.workspace, linkData.folderId);
  }

  return linkData;
};

// Seams for tests; callers use the defaults.
type LinkCreationDeps = {
  checkUrl?: typeof assertUrlSafe;
  fetchMetadata?: (url: string) => Promise<ScrapedMetadata>;
};

// Best-effort: a metadata-service outage must not block link creation.
async function fetchMetadataFailOpen(
  fetchMetadata: (url: string) => Promise<ScrapedMetadata>,
  url: string,
): Promise<ScrapedMetadata | null> {
  try {
    return await fetchMetadata(url);
  } catch (error) {
    const { code } = classifyLinkCreationError("metadata", error);
    log.warn({ step: "metadata", code }, "metadata fetch failed, creating link without it");
    return null;
  }
}

/** The URL and redirect-rule destinations of a link, for the campaign-pattern check. */
function linkDestinations(
  linkId: number,
  url: string | undefined,
  rules: { action: string; destination?: string | null }[] = [],
): LinkDestination[] {
  const urls = [
    url,
    ...rules.map((rule) => (rule.action === "redirect" ? rule.destination : null)),
  ];
  return urls.flatMap((u) => (u ? [{ linkId, url: u }] : []));
}

export const createLink = (
  ctx: WorkspaceTRPCContext,
  input: CreateLinkInput,
  deps: LinkCreationDeps = {},
) =>
  trackLinkCreation(ctx.db, "dashboard", ctx.auth.userId, (attempt) =>
    createLinkSteps(ctx, input, attempt, deps),
  );

const createLinkSteps = async (
  ctx: WorkspaceTRPCContext,
  input: CreateLinkInput,
  attempt: LinkCreationAttempt,
  { checkUrl = assertUrlSafe, fetchMetadata = scrapeMetadata }: LinkCreationDeps,
) => {
  const { plan, currentCount, limit } = await checkWorkspaceLinkLimit(ctx);
  const isPaidPlan = plan !== "free";

  const domain = input.domain?.trim() || DEFAULT_PLATFORM_DOMAIN;
  await assertDomainAllowed(ctx, domain);
  const alias =
    input.alias && input.alias !== "" ? input.alias : await generateUnreservedAlias(ctx.db, domain);

  attempt.step = "safety";
  const safety = await checkUrl(input.url, { account: workspaceSafetyAccount(ctx) });

  attempt.step = "metadata";
  const fetchedMetadata = await fetchMetadataFailOpen(fetchMetadata, input.url);

  attempt.step = "validation";
  if (input.alias) {
    await validateAlias(ctx, input.alias, domain, isPaidPlan);
  }

  if (input.password) {
    if (!isPaidPlan) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You need to upgrade to a pro plan to use password protection",
      });
    }

    input.password = await bcrypt.hash(input.password, 10);
  }

  if (input.activateAt && !isPaidPlan) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Scheduled links are only available on Pro and Ultra plans. Please upgrade to use this feature.",
    });
  }

  const inputMetaData = input.metadata;
  const metadataValues = Object.values(inputMetaData ?? {});
  const hasUserFilledMetadata = metadataValues.some(
    (value) => value !== undefined && value !== null && value !== "",
  );
  if (hasUserFilledMetadata) {
    if (!isPaidPlan) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You need to upgrade to a pro plan to use custom social media previews",
      });
    }
  }

  // Check for UTM params - Ultra plan only
  const utmParamsValues = Object.values(input.utmParams ?? {});
  const hasUtmParams = utmParamsValues.some(
    (value) => value !== undefined && value !== null && value !== "",
  );
  if (hasUtmParams) {
    if (plan !== "ultra") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "UTM parameters are only available on the Ultra plan. Please upgrade to use this feature.",
      });
    }
  }

  // Check for link cloaking - Ultra plan only
  if (input.cloaking) {
    if (plan !== "ultra") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Link cloaking is only available on the Ultra plan. Please upgrade to use this feature.",
      });
    }
  }

  if (input.verifiedClicksEnabled) assertCanEnableVerifiedClicks(plan);

  // Campaign membership: the campaign must belong to this workspace. On Pro+
  // its UTM defaults are stamped server-side (explicit user params win), which
  // is why this sits after the Ultra gate above — that gate only applies to
  // hand-entered params.
  if (input.campaignId) {
    const campaignRow = await ctx.db.query.campaign.findFirst({
      where: and(
        eq(campaign.id, input.campaignId),
        workspaceFilter(ctx.workspace, campaign.userId, campaign.teamId),
      ),
    });
    if (!campaignRow) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
    }
    if (campaignRow.status === "archived") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This campaign is archived. Restore it before adding links.",
      });
    }
    if (canUseCampaignUtmDefaults(plan)) {
      input.utmParams = mergeCampaignUtm(campaignRow, input.utmParams);
    }
  }

  input.metadata = {
    title: inputMetaData?.title ?? fetchedMetadata?.title,
    description: inputMetaData?.description ?? fetchedMetadata?.description,
    image: inputMetaData?.image ?? fetchedMetadata?.image,
  };

  const name = input.name ?? fetchedMetadata?.title ?? "Untitled Link";
  const tagNames = input.tags ?? [];

  if (input.metadata?.image) assertValidImageInput(input.metadata.image);

  // Plan checks run before the insert so a rejected request leaves no link behind.
  const geoRulesInput = input.geoRules;
  if (geoRulesInput && geoRulesInput.length > 0) {
    if (!canUseGeoRules(plan)) {
      await recordPlanLimitHit({ userId: ctx.auth.userId, limitKey: "geo_rules", plan });
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Targeting rules are only available on Pro and Ultra plans. Please upgrade to use this feature.",
      });
    }

    const geoLimit = getGeoRulesLimit(plan);
    if (!isUnlimitedGeoRules(plan) && geoLimit !== undefined && geoRulesInput.length > geoLimit) {
      await recordPlanLimitHit({ userId: ctx.auth.userId, limitKey: "geo_rules", plan });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Your plan allows a maximum of ${geoLimit} targeting rules per link. Please upgrade to Ultra for unlimited rules.`,
      });
    }
  }

  attempt.step = "db";
  // Create link without tags field
  const { tags: _tags, ...linkData } = input;
  const ownership = workspaceOwnership(ctx.workspace);

  // One transaction, so a failed tag or rule write doesn't leave a half-made link.
  const result = await ctx.db.transaction(async (tx) => {
    const [inserted] = await tx.insert(link).values({
      ...linkData,
      name,
      alias,
      userId: ownership.userId,
      teamId: ownership.teamId,
      createdByUserId: ctx.auth.userId, // Track the actual user who created the link
      passwordHash: input.password,
      domain,
      note: input.note,
      metadata: {
        ...input.metadata,
      },
      cloaking: input.cloaking ?? false,
      verifiedClicksEnabled: input.verifiedClicksEnabled ?? false,
      ...restrictedLinkValues(ctx.restrictedAt),
    });
    const insertedId = Number(inserted.insertId);

    if (tagNames.length > 0) {
      await associateTagsWithLink({ ...ctx, db: tx }, insertedId, tagNames);
    }

    if (geoRulesInput && geoRulesInput.length > 0) {
      await tx.insert(geoRule).values(
        geoRulesInput.map((rule, index) => ({
          linkId: insertedId,
          type: rule.type,
          condition: rule.condition,
          values: rule.values,
          action: rule.action,
          destination: rule.action === "redirect" ? rule.destination : null,
          blockMessage: rule.action === "block" ? rule.blockMessage : null,
          priority: index,
        })),
      );
    }

    return inserted;
  });
  const linkId = Number(result.insertId);
  recordSafetyFollowUp(linkId, safety);

  // Upload OG image to R2 if it's base64
  if (input.metadata?.image) {
    try {
      const imageUrl = await uploadImage(ctx, {
        image: input.metadata.image,
        resourceId: linkId,
        imageType: "og-image",
      });

      // Update link with the R2 URL if upload was successful and URL changed
      if (imageUrl && imageUrl !== input.metadata.image) {
        await ctx.db
          .update(link)
          .set({
            metadata: {
              ...input.metadata,
              image: imageUrl,
            },
          })
          .where(eq(link.id, linkId));
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      log.error({ err: error, linkId, action: "create" }, "failed to upload OG image");
      // Don't fail link creation if image upload fails - base64 is already saved
    }
  }

  await incrementWorkspaceLinkCount(ctx, currentCount, limit);
  checkCampaignPatternsAfterResponse(linkDestinations(linkId, input.url, geoRulesInput));

  return { id: linkId, alias, domain };
};

export const updateLink = async (ctx: WorkspaceTRPCContext, input: UpdateLinkInput) => {
  // Get existing link first
  const existingLink = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (!existingLink) {
    throw new Error("Link not found");
  }

  // Check folder access permission for team members
  if (existingLink.folderId) {
    await requireFolderAccess(ctx.db, ctx.workspace, existingLink.folderId);
  }

  // The workspace's live plan (a team's comes from its owner). Settings the link
  // already has are held to the usage plan, so they stay editable through an
  // over-plan grace; adding them needs the live plan.
  const workspacePlan = ctx.workspace.plan;
  const usagePlan = workspaceUsagePlan(ctx.workspace);
  const isPaidUser = workspacePlan !== "free";

  // Re-scan only when the destination actually changes: the check can reach
  // Safe Browsing / Web Risk and an LLM, and the current URL already passed it.
  const safety =
    input.url !== undefined && input.url !== existingLink.url
      ? await assertUrlSafe(input.url, { account: workspaceSafetyAccount(ctx) })
      : undefined;

  // If domain is being changed, it must be platform-owned or a verified
  // custom domain for this workspace. Either way it must be within the plan's
  // custom-domain allowance: domains past it take no new or edited links.
  if (input.domain !== undefined && input.domain !== existingLink.domain) {
    await assertDomainAllowed(ctx, input.domain);
  } else {
    await assertDomainWithinPlan(ctx, existingLink.domain);
  }

  // If alias is being changed, validate it
  const targetDomain = input.domain ?? existingLink.domain;
  const movesDomain = targetDomain.toLowerCase() !== existingLink.domain.toLowerCase();
  try {
    if (input.alias && input.alias !== existingLink.alias) {
      await validateAlias(ctx, input.alias, targetDomain, isPaidUser, existingLink.id);
    } else if (movesDomain && existingLink.alias) {
      // Moving the alias to another domain claims it there.
      await assertAliasAvailable(ctx, existingLink.alias, targetDomain, existingLink.id);
    }
  } catch (error) {
    if (movesDomain && error instanceof TRPCError && error.code === "CONFLICT") {
      throw new TRPCError({
        code: "CONFLICT",
        message: `"${input.alias || existingLink.alias}" is already taken on ${targetDomain}. Choose a different alias or domain.`,
      });
    }
    throw error;
  }

  // Paid-only settings can't be added or changed without the plan, but forms
  // resend every field, so a value that is unchanged (or being removed) passes:
  // after a downgrade, links keep their settings and other fields stay editable.
  if (
    input.activateAt &&
    (existingLink.activateAt ? usagePlan : workspacePlan) === "free" &&
    input.activateAt.getTime() !== existingLink.activateAt?.getTime()
  ) {
    throw new Error(
      "Scheduled links are only available on Pro and Ultra plans. Please upgrade to use this feature.",
    );
  }

  // Check for UTM params - Ultra plan only
  if (
    (hasUtmValues(existingLink.utmParams) ? usagePlan : workspacePlan) !== "ultra" &&
    hasUtmValues(input.utmParams) &&
    !sameUtmParams(input.utmParams, existingLink.utmParams)
  ) {
    throw new Error(
      "UTM parameters are only available on the Ultra plan. Please upgrade to use this feature.",
    );
  }

  // Check for link cloaking - Ultra plan only
  if (input.cloaking && !existingLink.cloaking && workspacePlan !== "ultra") {
    throw new Error(
      "Link cloaking is only available on the Ultra plan. Please upgrade to use this feature.",
    );
  }

  // Downgrades are caught again at token-issuance time in resolveShortLink, so a
  // stale `verifiedClicksEnabled=true` doesn't produce tokens for free users.
  if (input.verifiedClicksEnabled && !existingLink.verifiedClicksEnabled) {
    assertCanEnableVerifiedClicks(workspacePlan);
  }

  // Targeting rules over the plan's allowance may only be resubmitted unchanged.
  let geoRulesInput = input.geoRules;
  if (geoRulesInput !== undefined && geoRulesInput.length > 0) {
    const geoLimit = getGeoRulesLimit(workspacePlan);
    const rulesWithin = (plan: Plan, count: number) => {
      const limit = getGeoRulesLimit(plan);
      return (
        canUseGeoRules(plan) && (isUnlimitedGeoRules(plan) || limit === undefined || count <= limit)
      );
    };
    if (!rulesWithin(workspacePlan, geoRulesInput.length)) {
      const existingRules = await ctx.db
        .select()
        .from(geoRule)
        .where(eq(geoRule.linkId, input.id))
        .orderBy(asc(geoRule.priority));
      // During an over-plan grace a link's rules stay editable, without adding more.
      const editableInGrace =
        existingRules.length > 0 &&
        geoRulesInput.length <= existingRules.length &&
        rulesWithin(usagePlan, geoRulesInput.length);
      if (!editableInGrace) {
        if (!sameGeoRules(geoRulesInput, existingRules)) {
          await recordPlanLimitHit({
            userId: ctx.auth.userId,
            limitKey: "geo_rules",
            plan: workspacePlan,
          });
          throw new TRPCError({
            code: "FORBIDDEN",
            message: canUseGeoRules(workspacePlan)
              ? `Your plan allows a maximum of ${geoLimit} targeting rules per link. Please upgrade to Ultra for unlimited rules.`
              : "Targeting rules are only available on Pro and Ultra plans. Please upgrade to use this feature.",
          });
        }
        // Unchanged: leave the stored rules alone.
        geoRulesInput = undefined;
      }
    }
  }

  // If assigning to a campaign, it must belong to this workspace and be
  // active (null clears membership).
  if (input.campaignId !== undefined && input.campaignId !== null) {
    const campaignRow = await ctx.db.query.campaign.findFirst({
      where: and(
        eq(campaign.id, input.campaignId),
        workspaceFilter(ctx.workspace, campaign.userId, campaign.teamId),
      ),
    });
    if (!campaignRow) {
      throw new Error("Campaign not found");
    }
    if (campaignRow.status === "archived") {
      throw new Error("This campaign is archived. Restore it before adding links.");
    }
  }

  // Extract tags and geoRules from input
  const { tags: tagNames, geoRules: _geoRules, ...linkData } = input;

  if (geoRulesInput !== undefined && geoRulesInput.length > 0) {
    if (!canUseGeoRules(workspacePlan)) {
      await recordPlanLimitHit({
        userId: ctx.auth.userId,
        limitKey: "geo_rules",
        plan: workspacePlan,
      });
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Targeting rules are only available on Pro and Ultra plans. Please upgrade to use this feature.",
      });
    }

    const geoLimit = getGeoRulesLimit(workspacePlan);
    if (
      !isUnlimitedGeoRules(workspacePlan) &&
      geoLimit !== undefined &&
      geoRulesInput.length > geoLimit
    ) {
      await recordPlanLimitHit({
        userId: ctx.auth.userId,
        limitKey: "geo_rules",
        plan: workspacePlan,
      });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Your plan allows a maximum of ${geoLimit} targeting rules per link. Please upgrade to Ultra for unlimited rules.`,
      });
    }
  }

  // Upload OG image to R2 if it's base64
  if (linkData.metadata?.image) {
    try {
      const imageUrl = await uploadImage(ctx, {
        image: linkData.metadata.image,
        resourceId: input.id,
        imageType: "og-image",
      });

      // Update metadata with the R2 URL if upload was successful
      if (imageUrl) {
        linkData.metadata = {
          ...linkData.metadata,
          image: imageUrl,
        };
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      log.error({ err: error, linkId: input.id, action: "update" }, "failed to upload OG image");
      // Continue with the original image (base64 or URL) if upload fails
    }
  }

  const linkWhere = and(
    eq(link.id, input.id),
    workspaceFilter(ctx.workspace, link.userId, link.teamId),
  );

  // One transaction: tags are replaced by delete-then-insert, so a failure
  // part-way must not leave the link without its previous tags.
  await ctx.db.transaction(async (tx) => {
    if (existingLink.alias) {
      await recordAddressChange(
        tx,
        existingLink.id,
        { domain: existingLink.domain, alias: existingLink.alias },
        { domain: targetDomain, alias: input.alias || existingLink.alias },
      );
    }
    await tx.update(link).set(linkData).where(linkWhere);

    if (tagNames) {
      await associateTagsWithLink({ ...ctx, db: tx }, input.id, tagNames);
    }

    if (geoRulesInput !== undefined) {
      await tx.delete(geoRule).where(eq(geoRule.linkId, input.id));

      if (geoRulesInput.length > 0) {
        await tx.insert(geoRule).values(
          geoRulesInput.map((rule, index) => ({
            linkId: input.id,
            type: rule.type,
            condition: rule.condition,
            values: rule.values,
            action: rule.action,
            destination: rule.action === "redirect" ? rule.destination : null,
            blockMessage: rule.action === "block" ? rule.blockMessage : null,
            priority: index,
          })),
        );
      }
    }
  });

  if (geoRulesInput !== undefined) {
    await deleteGeoRulesFromCache(input.id);
  }

  const updatedLink = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (!updatedLink) {
    throw new Error("Link not found after update");
  }

  // Get tags for the updated link
  const tagRecords = await getTagsForLink(ctx, input.id);
  const updatedLinkWithTags = {
    ...updatedLink,
    tags: tagRecords.map((tagRecord) => tagRecord.name),
  };

  // If alias or domain changed, delete the OLD cache key (existingLink has the old values).
  // Old addresses of a moved link cache the row too.
  const staleKeys = await previousAddressCacheKeys(ctx.db, input.id);
  if (existingLink.alias !== updatedLink.alias || existingLink.domain !== updatedLink.domain) {
    staleKeys.push(buildCacheKey(existingLink.domain, existingLink.alias!));
  }
  await Promise.all(staleKeys.map((key) => deleteFromCache(key)));
  // Always set the new cache entry with updated values
  await setInCache(buildCacheKey(updatedLink.domain, updatedLink.alias!), updatedLinkWithTags);

  recordSafetyFollowUp(input.id, safety);
  // After the cache write, so a block from the check isn't overwritten by it.
  checkCampaignPatternsAfterResponse(
    linkDestinations(
      input.id,
      input.url !== existingLink.url ? input.url : undefined,
      geoRulesInput,
    ),
  );
};

export const deleteLink = async (ctx: WorkspaceTRPCContext, input: GetLinkInput) => {
  const linkToDelete = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (!linkToDelete) {
    return null;
  }

  // Check folder access permission for team members
  if (linkToDelete.folderId) {
    await requireFolderAccess(ctx.db, ctx.workspace, linkToDelete.folderId);
  }

  await removeLink(ctx.db, ctx.workspace, linkToDelete);
};

/**
 * Deletes a link the caller has already been authorized for, with its OG image,
 * milestones and the redirect cache entry. Shared by the dashboard and the v1 API.
 */
export const removeLink = async (
  db: WorkspaceTRPCContext["db"],
  workspace: WorkspaceContext,
  linkToDelete: Link,
) => {
  // Delete OG image from R2 if present
  const ogImage = storedOgImage(linkToDelete.metadata);
  if (ogImage) {
    try {
      await deleteImage(workspace, ogImage);
    } catch (error) {
      log.error({ err: error, linkId: linkToDelete.id }, "failed to delete OG image from R2");
    }
  }

  await db.delete(linkMilestone).where(eq(linkMilestone.linkId, linkToDelete.id));

  const where = and(
    eq(link.id, linkToDelete.id),
    workspaceFilter(workspace, link.userId, link.teamId),
  );
  const cacheKeys = [
    buildCacheKey(linkToDelete.domain, linkToDelete.alias!),
    ...(await previousAddressCacheKeys(db, linkToDelete.id)),
  ];
  await Promise.all([
    ...cacheKeys.map((key) => deleteFromCache(key)),
    db.transaction(async (tx) => {
      await reserveLinkAliases(tx, where, "deleted");
      await tx.delete(link).where(where);
    }),
  ]);
};

export const bulkDeleteLinks = async (ctx: WorkspaceTRPCContext, linkIds: number[]) => {
  if (linkIds.length === 0) {
    return { success: true, count: 0 };
  }

  // Fetch links to delete (for cache invalidation)
  let linksToDelete = await ctx.db.query.link.findMany({
    where: and(inArray(link.id, linkIds), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (linksToDelete.length === 0) {
    return { success: true, count: 0 };
  }

  // Filter by folder access for team members
  if (ctx.workspace.type === "team" && !isWorkspaceAdmin(ctx.workspace)) {
    const folderIds = [
      ...new Set(linksToDelete.map((l) => l.folderId).filter((id): id is number => id !== null)),
    ];
    const accessibleFolderIds =
      folderIds.length > 0 ? await getAccessibleFolderIds(ctx.db, ctx.workspace, folderIds) : [];
    linksToDelete = linksToDelete.filter(
      (l) => l.folderId === null || accessibleFolderIds.includes(l.folderId),
    );
  }

  if (linksToDelete.length === 0) {
    return { success: true, count: 0 };
  }

  const validLinkIds = linksToDelete.map((l) => l.id);

  // Delete OG images from R2 before removing links
  for (const l of linksToDelete) {
    const ogImage = storedOgImage(l.metadata);
    if (ogImage) {
      try {
        await deleteImage(ctx.workspace, ogImage);
      } catch (error) {
        log.error({ err: error, linkId: l.id }, "failed to delete OG image for link");
      }
    }
  }

  // Delete from database in transaction (delete dependents first)
  await ctx.db.transaction(async (tx) => {
    // 1. Delete link visits
    await tx.delete(linkVisit).where(inArray(linkVisit.linkId, validLinkIds));

    // 2. Delete unique link visits
    await tx.delete(uniqueLinkVisit).where(inArray(uniqueLinkVisit.linkId, validLinkIds));

    // 3. Delete link-tag associations
    await tx.delete(linkTag).where(inArray(linkTag.linkId, validLinkIds));

    // 4. Delete QR codes associated with links
    await tx.delete(qrcode).where(inArray(qrcode.linkId, validLinkIds));

    // 5. Delete milestone notifications
    await tx.delete(linkMilestone).where(inArray(linkMilestone.linkId, validLinkIds));

    // 6. Finally delete the links themselves, tombstoning their aliases
    await reserveLinkAliases(tx, inArray(link.id, validLinkIds), "deleted");
    await tx.delete(link).where(inArray(link.id, validLinkIds));
  });

  // Invalidate cache for all deleted links in the background. waitUntil keeps
  // the serverless function alive until every deleteFromCache settles.
  void runBackgroundTask(
    Promise.all(linksToDelete.map((l) => deleteFromCache(buildCacheKey(l.domain, l.alias!)))).catch(
      (err) => {
        log.error(
          { err, count: linksToDelete.length },
          "failed to invalidate cache for deleted links",
        );
      },
    ),
  );

  return { success: true, count: linksToDelete.length };
};

export const bulkArchiveLinks = async (ctx: WorkspaceTRPCContext, input: BulkArchiveLinksInput) => {
  const { linkIds, archive } = input;

  if (linkIds.length === 0) {
    return { success: true, count: 0 };
  }

  // Verify links belong to workspace
  let linksToUpdate = await ctx.db.query.link.findMany({
    where: and(inArray(link.id, linkIds), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (linksToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  // Filter by folder access for team members
  if (ctx.workspace.type === "team" && !isWorkspaceAdmin(ctx.workspace)) {
    const folderIds = [
      ...new Set(linksToUpdate.map((l) => l.folderId).filter((id): id is number => id !== null)),
    ];
    const accessibleFolderIds =
      folderIds.length > 0 ? await getAccessibleFolderIds(ctx.db, ctx.workspace, folderIds) : [];
    linksToUpdate = linksToUpdate.filter(
      (l) => l.folderId === null || accessibleFolderIds.includes(l.folderId),
    );
  }

  if (linksToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  const validLinkIds = linksToUpdate.map((l) => l.id);

  await ctx.db.update(link).set({ archived: archive }).where(inArray(link.id, validLinkIds));

  return { success: true, count: linksToUpdate.length, archived: archive };
};

export const bulkToggleLinkStatus = async (
  ctx: WorkspaceTRPCContext,
  input: BulkToggleLinkStatusInput,
) => {
  const { linkIds, disable } = input;

  if (linkIds.length === 0) {
    return { success: true, count: 0 };
  }

  // Verify links belong to workspace
  let linksToUpdate = await ctx.db.query.link.findMany({
    where: and(inArray(link.id, linkIds), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (linksToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  // Filter by folder access for team members
  if (ctx.workspace.type === "team" && !isWorkspaceAdmin(ctx.workspace)) {
    const folderIds = [
      ...new Set(linksToUpdate.map((l) => l.folderId).filter((id): id is number => id !== null)),
    ];
    const accessibleFolderIds =
      folderIds.length > 0 ? await getAccessibleFolderIds(ctx.db, ctx.workspace, folderIds) : [];
    linksToUpdate = linksToUpdate.filter(
      (l) => l.folderId === null || accessibleFolderIds.includes(l.folderId),
    );
  }

  if (linksToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  const validLinkIds = linksToUpdate.map((l) => l.id);

  await ctx.db.update(link).set({ disabled: disable }).where(inArray(link.id, validLinkIds));

  // Invalidate cache for all affected links
  await Promise.all(
    linksToUpdate
      .filter((l) => l.alias)
      .map((l) => deleteFromCache(buildCacheKey(l.domain, l.alias!))),
  );

  return { success: true, count: linksToUpdate.length, disabled: disable };
};

/**
 * Full link row by alias, cache-first. Server-only: the row carries the
 * destination, password hash and owner fields, so it must never be returned
 * from a public procedure as-is (see `retrieveOriginalUrl`).
 */
export const findLinkByAlias = async (
  input: Pick<RetrieveOriginalUrlInput, "alias" | "domain">,
) => {
  // The same lookup as the redirect, so previews and metadata also follow moved links.
  const found = await resolveLink(input.domain, input.alias);
  return found?.alias ? found : null;
};

export const retrieveOriginalUrl = async (
  ctx: PublicTRPCContext,
  input: RetrieveOriginalUrlInput,
) => {
  const found = await findLinkByAlias(input);
  return found ? toPublicLink(found) : null;
};

export const shortenLinkWithAutoAlias = (
  ctx: WorkspaceTRPCContext,
  input: QuickLinkShorteningInput,
) =>
  trackLinkCreation(ctx.db, "dashboard", ctx.auth.userId, (attempt) =>
    shortenLinkSteps(ctx, input, attempt),
  );

const shortenLinkSteps = async (
  ctx: WorkspaceTRPCContext,
  input: QuickLinkShorteningInput,
  attempt: LinkCreationAttempt,
) => {
  const { currentCount, limit } = await checkWorkspaceLinkLimit(ctx);

  const savedDomain = await getWorkspaceDefaultDomain(ctx);
  // The saved default can outlive the domain (deleted, or never verified)
  await assertDomainOwned(ctx, savedDomain);
  const domain = await toPlanAllowedDomain(ctx, savedDomain);
  const alias = await generateUnreservedAlias(ctx.db, domain);

  attempt.step = "safety";
  const safety = await assertUrlSafe(input.url, { account: workspaceSafetyAccount(ctx) });

  attempt.step = "metadata";
  const fetchedMetadata = await fetchMetadataFailOpen(scrapeMetadata, input.url);
  const name = fetchedMetadata?.title ?? "Untitled Link";
  const tagNames = input.tags ?? [];
  const ownership = workspaceOwnership(ctx.workspace);

  attempt.step = "db";
  const result = await ctx.db.transaction(async (tx) => {
    const [inserted] = await tx.insert(link).values({
      url: input.url,
      alias,
      domain,
      userId: ownership.userId,
      teamId: ownership.teamId,
      createdByUserId: ctx.auth.userId, // Track the actual user who created the link
      name,
      metadata: {
        title: fetchedMetadata?.title,
        description: fetchedMetadata?.description,
        image: fetchedMetadata?.image,
      },
      ...restrictedLinkValues(ctx.restrictedAt),
    });

    if (tagNames.length > 0) {
      await associateTagsWithLink({ ...ctx, db: tx }, Number(inserted.insertId), tagNames);
    }

    return inserted;
  });

  await incrementWorkspaceLinkCount(ctx, currentCount, limit);
  recordSafetyFollowUp(Number(result.insertId), safety);
  checkCampaignPatternsAfterResponse(linkDestinations(Number(result.insertId), input.url));

  return {
    id: result.insertId,
    alias,
    domain,
  };
};

// Ranked after grouping so aliases of one source ("twitter", "x.com") count together.
const topReferrerName = (referers: Record<string, number>) =>
  groupReferrers(referers).reduce<{ name: string; clicks: number } | null>(
    (top, row) => (top && top.clicks >= row.clicks ? top : row),
    null,
  )?.name ?? "Direct";

/**
 * A link's visits and unique visits inside a window, plus the per-day counts archived from
 * visits past the retention window. Shared by the owner's and the shared stats pages.
 */
export const getLinkVisitsInWindow = (
  db: WorkspaceTRPCContext["db"],
  linkId: number,
  from: Date,
  to: Date,
) =>
  Promise.all([
    db.query.linkVisit.findMany({
      where: (visit, { eq, and, gte, lte }) =>
        and(eq(visit.linkId, linkId), gte(visit.createdAt, from), lte(visit.createdAt, to)),
    }),
    db.query.uniqueLinkVisit.findMany({
      where: (visit, { eq, and, gte, lte }) =>
        and(eq(visit.linkId, linkId), gte(visit.createdAt, from), lte(visit.createdAt, to)),
    }),
    db.query.linkVisitDailySummary.findMany({
      where: (s, { eq, and, gte, lte }) =>
        and(eq(s.linkId, linkId), gte(s.date, bucketKey(from)), lte(s.date, bucketKey(to))),
    }),
  ]);

/**
 * Clicks on these links before `before`, raw visits plus archived daily summaries, in one
 * statement: the count uses the (linkId, createdAt) index, the subquery the (linkId, date) one.
 * Summary rows only hold whole days, and `before` is a UTC midnight, so neither side overlaps.
 */
export const countClicksBefore = async (
  db: WorkspaceTRPCContext["db"],
  linkIds: number[],
  before: Date,
) => {
  if (linkIds.length === 0) return 0;
  const archived = db
    .select({ clicks: sql`coalesce(sum(${linkVisitDailySummary.clicks}), 0)` })
    .from(linkVisitDailySummary)
    .where(
      and(
        inArray(linkVisitDailySummary.linkId, linkIds),
        lt(linkVisitDailySummary.date, bucketKey(before)),
      ),
    );
  const [row] = await db
    .select({ clicks: sql<number>`count(*) + (${archived})`.mapWith(Number) })
    .from(linkVisit)
    .where(and(inArray(linkVisit.linkId, linkIds), lt(linkVisit.createdAt, before)));
  return row?.clicks ?? 0;
};

export const getLinkVisits = async (ctx: WorkspaceTRPCContext, input: LinkVisitsInput) => {
  // Use workspace plan - team workspaces inherit Ultra features
  const plan = ctx.workspace.plan;
  const userHasPaidPlan = plan !== "free";

  const domain = input.domain ?? (await getWorkspaceDefaultDomain(ctx));

  // Use workspace filtering to ensure the link belongs to the current workspace
  const foundLink = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.alias, input.id),
      eq(link.domain, domain),
      workspaceFilter(ctx.workspace, link.userId, link.teamId),
    ),
  });

  if (!foundLink) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Link not found" });
  }

  const { range, custom } = resolveAnalyticsRange(input, userHasPaidPlan);
  const window = resolveRangeWindow(range, new Date(), custom);
  const startDate = window.from ?? new Date(0);
  const now = window.to;

  // Previous-period window for % delta: same duration immediately before
  // the current window. Skip for "all" and for inverted windows that can
  // arise from calendar ranges landing on a non-positive duration.
  const windowMs = now.getTime() - startDate.getTime();
  const hasPreviousPeriod = range !== "all" && windowMs > 0;
  const prevEnd = startDate;
  const prevStart = new Date(startDate.getTime() - windowMs);

  const [
    [totalVisits, uniqueVisits, summaries],
    linkGeoRules,
    prevCounts,
    prevSummaries,
    hiddenClicks,
  ] = await Promise.all([
    getLinkVisitsInWindow(ctx.db, foundLink.id, startDate, now),
    ctx.db.query.geoRule.findMany({
      where: (rule, { eq }) => eq(rule.linkId, foundLink.id),
      columns: {
        id: true,
        action: true,
      },
    }),
    hasPreviousPeriod
      ? Promise.all([
          ctx.db
            .select({
              total: count(),
              verified: sql<number>`SUM(CASE WHEN ${linkVisit.verifiedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
            })
            .from(linkVisit)
            .where(
              and(
                eq(linkVisit.linkId, foundLink.id),
                gte(linkVisit.createdAt, prevStart),
                lt(linkVisit.createdAt, prevEnd),
              ),
            ),
          ctx.db
            .select({ value: count() })
            .from(uniqueLinkVisit)
            .where(
              and(
                eq(uniqueLinkVisit.linkId, foundLink.id),
                gte(uniqueLinkVisit.createdAt, prevStart),
                lt(uniqueLinkVisit.createdAt, prevEnd),
              ),
            ),
        ])
      : Promise.resolve(null),
    hasPreviousPeriod
      ? ctx.db
          .select({
            clicks: sum(linkVisitDailySummary.clicks),
            uniqueClicks: sum(linkVisitDailySummary.uniqueClicks),
          })
          .from(linkVisitDailySummary)
          .where(
            and(
              eq(linkVisitDailySummary.linkId, foundLink.id),
              gte(linkVisitDailySummary.date, bucketKey(prevStart)),
              lt(linkVisitDailySummary.date, bucketKey(prevEnd)),
            ),
          )
      : Promise.resolve(null),
    userHasPaidPlan
      ? Promise.resolve(0)
      : countClicksBefore(ctx.db, [foundLink.id], freeAnalyticsWindowStart(now)),
  ]);

  const archived = summarizeArchived(summaries);

  const previous = prevCounts
    ? {
        total: (prevCounts[0][0]?.total ?? 0) + (Number(prevSummaries?.[0]?.clicks) || 0),
        unique: (prevCounts[1][0]?.value ?? 0) + (Number(prevSummaries?.[0]?.uniqueClicks) || 0),
        verified: Number(prevCounts[0][0]?.verified ?? 0),
      }
    : null;

  if (totalVisits.length === 0) {
    return {
      linkId: foundLink.id,
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasPaidPlan,
      geoRules: linkGeoRules,
      previous,
      archived,
      hiddenClicks,
      domain,
      range,
      custom,
      window,
    };
  }

  const countryVisits = totalVisits.reduce<Record<string, number>>((acc, visit) => {
    // Skip null/undefined country values
    if (visit.country) {
      acc[visit.country] = (acc[visit.country] ?? 0) + 1;
    }
    return acc;
  }, {});
  const topCountry = Object.entries(countryVisits).reduce(
    (a, b) => (a[1] > b[1] ? a : b),
    ["", 0],
  )[0];

  const referrerVisits = totalVisits.reduce<Record<string, number>>((acc, visit) => {
    // Skip null/undefined referer values
    if (visit.referer) {
      acc[visit.referer] = (acc[visit.referer] ?? 0) + 1;
    }
    return acc;
  }, {});

  return {
    linkId: foundLink.id,
    totalVisits,
    uniqueVisits,
    topCountry,
    referers: referrerVisits,
    topReferrer: topReferrerName(referrerVisits),
    isProPlan: userHasPaidPlan,
    geoRules: linkGeoRules,
    previous,
    archived,
    hiddenClicks,
    domain,
    range,
    custom,
    window,
  };
};

export const getAllUserAnalytics = async (ctx: WorkspaceTRPCContext, input: AllAnalyticsInput) => {
  // Use workspace plan - team workspaces inherit Ultra features
  const plan = ctx.workspace.plan;
  const userHasPaidPlan = plan !== "free";

  const { range, custom } = resolveAnalyticsRange(input, userHasPaidPlan);
  const window = resolveRangeWindow(range, new Date(), custom);
  const startDate = window.from ?? new Date(0);
  const now = window.to;
  const empty = {
    totalVisits: [],
    uniqueVisits: [],
    topCountry: "N/A",
    referers: {},
    topReferrer: "N/A",
    isProPlan: userHasPaidPlan,
    clicksByLink: {},
    clicksByDestination: {},
    archived: summarizeArchived([]),
    hiddenClicks: 0,
    range,
    custom,
    window,
  };

  // Fetch workspace links with optional filtering
  const userLinks = await ctx.db.query.link.findMany({
    where: and(...overviewLinkConditions(ctx.workspace, input)),
  });

  if (userLinks.length === 0) {
    return empty;
  }

  const linkIds = userLinks.map((link) => link.id);

  // Fetch all visits for all links, plus the per-day counts archived from
  // visits past the retention window (summed in SQL, so one row per day).
  const [totalVisits, uniqueVisits, summaries, hiddenClicks] = await Promise.all([
    ctx.db.query.linkVisit.findMany({
      where: (visit, { inArray, and, gte, lte }) =>
        and(
          inArray(visit.linkId, linkIds),
          gte(visit.createdAt, startDate),
          lte(visit.createdAt, now),
        ),
    }),
    ctx.db.query.uniqueLinkVisit.findMany({
      where: (visit, { inArray, and, gte, lte }) =>
        and(
          inArray(visit.linkId, linkIds),
          gte(visit.createdAt, startDate),
          lte(visit.createdAt, now),
        ),
    }),
    ctx.db
      .select({
        date: linkVisitDailySummary.date,
        clicks: sum(linkVisitDailySummary.clicks).mapWith(Number),
        uniqueClicks: sum(linkVisitDailySummary.uniqueClicks).mapWith(Number),
      })
      .from(linkVisitDailySummary)
      .where(
        and(
          inArray(linkVisitDailySummary.linkId, linkIds),
          gte(linkVisitDailySummary.date, bucketKey(startDate)),
          lte(linkVisitDailySummary.date, bucketKey(now)),
        ),
      )
      .groupBy(linkVisitDailySummary.date),
    userHasPaidPlan
      ? Promise.resolve(0)
      : countClicksBefore(ctx.db, linkIds, freeAnalyticsWindowStart(now)),
  ]);

  const archived = summarizeArchived(summaries);

  if (totalVisits.length === 0) {
    return { ...empty, archived, hiddenClicks };
  }

  // Aggregate clicks by link
  const clicksByLink: Record<string, number> = {};
  const clicksByDestination: Record<string, number> = {};
  const linkIdToInfo = new Map(
    userLinks.map((link) => [
      link.id,
      { shortLink: `${link.domain}/${link.alias}`, destination: link.url },
    ]),
  );

  totalVisits.forEach((visit) => {
    const linkInfo = linkIdToInfo.get(visit.linkId);
    if (linkInfo) {
      clicksByLink[linkInfo.shortLink] = (clicksByLink[linkInfo.shortLink] ?? 0) + 1;
      if (linkInfo.destination) {
        clicksByDestination[linkInfo.destination] =
          (clicksByDestination[linkInfo.destination] ?? 0) + 1;
      }
    }
  });

  // Calculate top country
  const countryVisits = totalVisits.reduce<Record<string, number>>((acc, visit) => {
    if (visit.country) {
      acc[visit.country] = (acc[visit.country] ?? 0) + 1;
    }
    return acc;
  }, {});
  const topCountry =
    Object.entries(countryVisits).length > 0
      ? Object.entries(countryVisits).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
      : "N/A";

  // Calculate referrers
  const referrerVisits = totalVisits.reduce<Record<string, number>>((acc, visit) => {
    const ref = visit.referer ?? "null";
    acc[ref] = (acc[ref] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers: referrerVisits,
    topReferrer: topReferrerName(referrerVisits),
    isProPlan: userHasPaidPlan,
    clicksByLink,
    clicksByDestination,
    archived,
    hiddenClicks,
    range,
    custom,
    window,
  };
};

export const togglePublicStats = async (ctx: WorkspaceTRPCContext, input: GetLinkInput) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (!fetchedLink) {
    return null;
  }

  return ctx.db
    .update(link)
    .set({
      publicStats: !fetchedLink.publicStats,
    })
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));
};

export const toggleLinkStatus = async (ctx: WorkspaceTRPCContext, input: GetLinkInput) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (!fetchedLink) {
    return null;
  }

  const result = await ctx.db
    .update(link)
    .set({
      disabled: !fetchedLink.disabled,
    })
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

  // Invalidate cache so the status change takes effect immediately
  if (fetchedLink.alias) {
    await deleteFromCache(buildCacheKey(fetchedLink.domain, fetchedLink.alias));
  }

  return result;
};

export const resetLinkStatistics = async (ctx: WorkspaceTRPCContext, input: GetLinkInput) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (!fetchedLink) {
    return null;
  }

  // Clearing the counter restarts the click limit from what is left of the recorded total.
  await Promise.all([
    ctx.db.delete(linkVisit).where(eq(linkVisit.linkId, fetchedLink.id)),
    ctx.db.update(link).set({ clickLimitCount: null }).where(eq(link.id, fetchedLink.id)),
  ]);

  return fetchedLink;
};

export const verifyLinkPassword = async (
  ctx: PublicTRPCContext,
  input: VerifyLinkPasswordInput,
) => {
  // Checked before bcrypt so a refused guess costs no hashing. KV has no atomic
  // increment and is eventually consistent, so concurrent guesses can slip a
  // few past the limit; it still caps brute force at a useless rate.
  const ip = getClientIp(ctx.headers);
  const attemptKeys = [
    { key: `pwattempts:link:${input.id}`, limit: PASSWORD_ATTEMPTS_PER_LINK },
    ...(ip ? [{ key: `pwattempts:ip:${hashIp(ip)}`, limit: PASSWORD_ATTEMPTS_PER_IP }] : []),
  ];
  const now = Date.now();
  const attempts = await Promise.all(
    attemptKeys.map(async ({ key, limit }) => ({
      key,
      limit,
      window: readAttemptWindow(await getStringFromCache(key), now),
    })),
  );
  if (attempts.some(({ window, limit }) => window.count >= limit)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts, try again later",
    });
  }

  const link = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  // Unknown links and links without a password get the same answer as a wrong
  // password, so this endpoint can't be used to probe which ids exist.
  const isPasswordCorrect =
    !!link?.passwordHash && (await bcrypt.compare(input.password, link.passwordHash));

  if (!link || !isPasswordCorrect) {
    await Promise.all(
      attempts.map(({ key, window }) =>
        setStringInCache(
          key,
          recordFailedAttempt(window),
          Math.ceil((window.resetAt - now) / 1000),
        ),
      ),
    );
    throw new TRPCError({ code: "BAD_REQUEST", message: "Wrong password, try again" });
  }

  // A correct password is not an access grant. This procedure is callable with
  // nothing but an id and the password, so it has to re-apply the same policy
  // the redirect path enforces — otherwise a visitor keeps resolving a link the
  // owner has since blocked, disabled, expired, or geo-restricted.
  if (link.blocked) {
    return { url: `/blocked/${link.id}`, alias: link.alias, verificationToken: null };
  }

  const cacheKey = buildCacheKey(link.domain, link.alias ?? "");
  if (await checkLinkExpiration(link, cacheKey)) {
    return { url: `/expired/${link.id}`, alias: link.alias, verificationToken: null };
  }
  if (isLinkScheduled(link)) {
    return { url: `/scheduled/${link.id}`, alias: link.alias, verificationToken: null };
  }

  const linkGeoRules = await ctx.db.query.geoRule.findMany({
    where: eq(geoRule.linkId, link.id),
    orderBy: [asc(geoRule.priority)],
  });
  const deviceDetails = await parseDeviceDetails(ctx.headers);
  // Same geo source the redirect path uses; the matcher expects a country
  // code (not the display name analytics records).
  const geo = getRequestGeo();
  const geoResult = matchTargetingRules(linkGeoRules, {
    country: geo.country ?? null,
    device: deviceDetails.device,
    os: deviceDetails.os,
  });

  if (geoResult.matched && geoResult.action === "block") {
    const geoParam = geoResult.ruleId ? `?geo=${geoResult.ruleId}` : "";
    return {
      url: `/blocked/${link.id}${geoParam}`,
      alias: link.alias,
      verificationToken: null,
    };
  }

  const destination = geoResult.matched ? geoResult.destination : link.url;

  const tokenIssue = destination ? await issueVerifiedClickToken(link, destination) : null;

  await recordClick({
    headers: ctx.headers,
    link,
    ip: getClientIp(ctx.headers) ?? "",
    country: geo.country ?? "",
    city: geo.city ?? "",
    matchedGeoRuleId: geoResult.matched ? geoResult.ruleId : undefined,
    visitId: tokenIssue?.visitId ?? null,
  });

  return {
    url: destination,
    alias: link.alias,
    verificationToken: tokenIssue?.verificationToken ?? null,
  };
};

export const changeLinkPassword = async (
  ctx: WorkspaceTRPCContext,
  input: { id: number; password: string },
) => {
  const existing = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
    columns: { domain: true, passwordHash: true },
  });
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Link not found" });
  }
  // A link that already has a password can change it through an over-plan grace.
  const plan = existing.passwordHash ? workspaceUsagePlan(ctx.workspace) : ctx.workspace.plan;
  if (plan === "free") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You need to upgrade to a pro plan to use password protection",
    });
  }
  await assertDomainWithinPlan(ctx, existing.domain);

  const passwordHash = await bcrypt.hash(input.password, 10);

  await ctx.db
    .update(link)
    .set({
      passwordHash,
    })
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

  const updatedLink = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  await deleteFromCache(buildCacheKey(updatedLink!.domain, updatedLink!.alias!));

  return updatedLink;
};

export const checkAliasAvailability = async (
  ctx: PublicTRPCContext,
  input: { alias: string; domain: string },
) => {
  // Same check as link creation, so the preview can't say "available" for an
  // alias that create will then reject.
  try {
    await assertAliasAvailable(ctx, input.alias, input.domain);
    return { isAvailable: true };
  } catch (error) {
    if (error instanceof TRPCError && error.code === "CONFLICT") return { isAvailable: false };
    throw error;
  }
};

// Alias checks, URL scans and inserts each hold a db connection or an outbound
// request; cap them so a 1,000-row file doesn't fan out all at once.
const CSV_IMPORT_CONCURRENCY = 8;

type ImportLink = {
  row: number;
  url: string;
  domain: string;
  alias?: string;
  name?: string;
  note?: string;
  /** Bitly domain the row's link can't move off; it lands on the workspace default instead. */
  movedFrom?: string;
  /** Custom back-half of a moved row that isn't available here, so a generated alias is used. */
  unavailableAlias?: string;
};

type PreparedLink = { record: ImportLink; alreadyImported: boolean };

export type BulkCreateLinksOptions = {
  /** Bitly exports: also create the random code of a custom link on the same domain. */
  keepBitlyCodes?: boolean;
};

type CheckImportUrl = (url: string) => Promise<UrlSafetyResult | void>;

// One account for the whole import, so its age is looked up at most once.
const checkImportUrl = (ctx: WorkspaceTRPCContext): CheckImportUrl => {
  const account = workspaceSafetyAccount(ctx);
  return (url) => assertUrlSafe(url, { account });
};

// `checkUrl` is a seam for tests; callers use the default.
export const bulkCreateLinks = (
  ctx: WorkspaceTRPCContext,
  csvContent: string,
  checkUrl: CheckImportUrl = checkImportUrl(ctx),
  options: BulkCreateLinksOptions = {},
) =>
  // Records failures that reject the whole import; per-row failures are recorded below.
  trackLinkCreation(ctx.db, "bulk", ctx.auth.userId, () =>
    bulkCreateLinkRows(ctx, csvContent, checkUrl, options),
  );

const importAliasKey = (domain: string, alias: string) =>
  `${domain.toLowerCase()}/${normalizeAlias(alias)}`;

/**
 * The workspace's links that an earlier run of the same file created: same
 * alias on the same domain, or (for Bitly links that moved to a generated
 * alias) the same import note. Both also need the same destination.
 */
const findPreviousImports = async (
  ctx: WorkspaceTRPCContext,
  aliases: string[],
  notes: string[],
) => {
  const scope = workspaceFilter(ctx.workspace, link.userId, link.teamId);
  const columns = { alias: link.alias, domain: link.domain, url: link.url, note: link.note };
  const [byAlias, byNote] = await Promise.all([
    aliases.length
      ? ctx.db
          .select(columns)
          .from(link)
          .where(and(scope, inArray(link.alias, aliases)))
      : [],
    notes.length
      ? ctx.db
          .select(columns)
          .from(link)
          .where(and(scope, inArray(link.note, notes)))
      : [],
  ]);
  return {
    aliases: new Set(
      byAlias.flatMap((row) =>
        row.alias ? [`${importAliasKey(row.domain, row.alias)} ${row.url}`] : [],
      ),
    ),
    notes: new Set(byNote.map((row) => `${row.note}\n${row.url}`)),
  };
};

const importErrorMessage = ({ reason }: PromiseRejectedResult) =>
  reason instanceof Error ? reason.message : "Could not create this link";

const bulkCreateLinkRows = async (
  ctx: WorkspaceTRPCContext,
  csvContent: string,
  checkUrl: CheckImportUrl,
  { keepBitlyCodes = true }: BulkCreateLinksOptions,
) => {
  const parsed = parseLinkCsv(csvContent);
  const isBitlyFile = parsed.some((row) => row.bitly);
  // Links deleted in Bitly are neither created nor counted toward the allowance.
  const rows = parsed.filter((row) => !row.bitly?.deleted);
  const skipped = parsed.length - rows.length;

  // Throws when the monthly allowance and the custom-domain import allowance are
  // both used up, rejecting the whole import.
  const { plan, currentCount, limit, importAllowanceLeft } = await checkWorkspaceLinkLimit(ctx, {
    customDomainImport: true,
  });
  const isPaidPlan = plan !== "free";
  const remaining = limit === undefined ? Number.POSITIVE_INFINITY : limit - currentCount;

  const bitlyHost = (row: CsvLinkRow) =>
    row.bitly && row.domain && BITLY_DOMAINS.has(row.domain) ? row.domain : undefined;
  const workspaceDomain = rows.some(bitlyHost) ? await getWorkspaceDefaultDomain(ctx) : undefined;

  // One ownership lookup per distinct domain, not per row.
  const domainErrors = new Map<string, unknown>();
  await settleWithConcurrency(
    [
      ...new Set([
        ...rows.flatMap((row) => (bitlyHost(row) ? [] : [row.domain ?? DEFAULT_PLATFORM_DOMAIN])),
        ...(workspaceDomain ? [workspaceDomain] : []),
      ]),
    ],
    CSV_IMPORT_CONCURRENCY,
    async (domain) => {
      try {
        await assertDomainOwned(ctx, domain);
      } catch (error) {
        domainErrors.set(
          domain,
          isBitlyFile
            ? new TRPCError({
                code: "FORBIDDEN",
                message: `${domain} isn't connected to this workspace. Add it in Domains, wait until it shows Active, then import this file again.`,
              })
            : error,
        );
        return;
      }
      try {
        await assertDomainWithinPlan(ctx, domain);
      } catch (error) {
        domainErrors.set(domain, error);
      }
    },
  );
  const movedDomain =
    workspaceDomain && !domainErrors.has(workspaceDomain)
      ? workspaceDomain
      : DEFAULT_PLATFORM_DOMAIN;

  const records = rows.map((row): ImportLink => {
    const movedFrom = bitlyHost(row);
    return {
      row: row.row,
      url: row.url,
      domain: movedFrom ? movedDomain : (row.domain ?? DEFAULT_PLATFORM_DOMAIN),
      // Bitly's random code means nothing on another domain; only a custom back-half moves.
      alias: movedFrom && !row.bitly?.custom ? undefined : row.alias,
      name: row.name,
      note: row.note,
      movedFrom,
    };
  });
  const codeOf = (index: number) =>
    keepBitlyCodes && !records[index]!.movedFrom ? rows[index]!.bitly?.code : undefined;

  const previous = await findPreviousImports(
    ctx,
    [
      ...new Set([
        ...records.flatMap((record) => (record.alias ? [record.alias] : [])),
        ...records.flatMap((_, index) => codeOf(index) ?? []),
      ]),
    ],
    records.flatMap((record) => (record.movedFrom && record.note ? [record.note] : [])),
  );

  // Two rows claiming the same alias on the same domain would otherwise race on
  // the unique index; the first one in the file wins. Tasks start in file order
  // and check this before their first await.
  const seenAliases = new Set<string>();
  const prepare = async (record: ImportLink): Promise<PreparedLink> => {
    const key = record.alias ? importAliasKey(record.domain, record.alias) : undefined;
    const taken = !!key && seenAliases.has(key);
    if (key) seenAliases.add(key);

    if (
      (key && !taken && previous.aliases.has(`${key} ${record.url}`)) ||
      (record.movedFrom && previous.notes.has(`${record.note}\n${record.url}`))
    ) {
      return { record, alreadyImported: true };
    }
    if (!record.alias) return { record, alreadyImported: false };

    try {
      if (taken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Alias is used by an earlier row in this file",
        });
      }
      if (record.alias.length > LINK_ALIAS_MAX_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Alias can be at most ${LINK_ALIAS_MAX_LENGTH} characters`,
        });
      }
      await validateAlias(ctx, record.alias, record.domain, isPaidPlan);
    } catch (error) {
      // A moved bit.ly link gets a new address anyway, so its back-half is optional.
      if (!record.movedFrom) throw error;
      return {
        record: { ...record, alias: undefined, unavailableAlias: record.alias },
        alreadyImported: false,
      };
    }
    return { record, alreadyImported: false };
  };

  const validated = await settleWithConcurrency(
    records,
    CSV_IMPORT_CONCURRENCY,
    (record, index) => {
      const rowError = rows[index]!.bitly?.error;
      if (rowError) throw new TRPCError({ code: "BAD_REQUEST", message: rowError });
      if (!record.url) throw new TRPCError({ code: "BAD_REQUEST", message: "Missing url" });
      const url = normalizeDestinationUrl(record.url);
      if (!url) throw new TRPCError({ code: "BAD_REQUEST", message: INVALID_URL_MESSAGE });
      if (record.note && record.note.length > LINK_NOTE_MAX_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Note can be at most ${LINK_NOTE_MAX_LENGTH} characters`,
        });
      }
      const domainError = domainErrors.get(record.domain);
      if (domainError) throw domainError;
      return prepare({ ...record, url });
    },
  );

  // Allowance goes to valid links in file order, before the (slow) URL safety
  // scan, so links past the limit are never scanned.
  let allotted = 0;
  let importAllotted = 0;
  // Rows often share a destination, and a Bitly code always shares its row's.
  const scans = new Map<string, Promise<UrlSafetyResult | void>>();
  const createdDestinations: LinkDestination[] = [];
  const createLinks = async (checks: PromiseSettledResult<PreparedLink>[]) => {
    const steps = checks.map((): LinkCreationStep => "validation");
    const usesImportAllowance = checks.map(() => false);
    const results = await settleWithConcurrency(
      checks,
      CSV_IMPORT_CONCURRENCY,
      async (check, index) => {
        if (check.status === "rejected") throw check.reason;
        const { record, alreadyImported } = check.value;
        if (alreadyImported) return check.value;
        // The domain passed assertDomainOwned and assertDomainWithinPlan, so a
        // non-platform one is an active custom domain of this workspace.
        if (
          !isPlatformDomain(record.domain.toLowerCase()) &&
          importAllotted < importAllowanceLeft
        ) {
          importAllotted++;
          usesImportAllowance[index] = true;
        } else if (allotted >= remaining) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Monthly limit of ${limit?.toLocaleString()} links reached. Upgrade your plan to create more.`,
          });
        } else {
          allotted++;
        }

        steps[index] = "safety";
        let scan = scans.get(record.url);
        if (!scan) {
          scan = checkUrl(record.url);
          scans.set(record.url, scan);
        }
        const safety = await scan;

        steps[index] = "db";
        const ownership = workspaceOwnership(ctx.workspace);
        const alias = record.alias ?? (await generateUnreservedAlias(ctx.db, record.domain));
        const [inserted] = await ctx.db.insert(link).values({
          url: record.url,
          alias,
          name: record.name,
          userId: ownership.userId,
          teamId: ownership.teamId,
          createdByUserId: ctx.auth.userId, // Track the actual user who created the link
          domain: record.domain,
          note: record.note,
          ...restrictedLinkValues(ctx.restrictedAt),
        });
        recordSafetyFollowUp(Number(inserted.insertId), safety);
        createdDestinations.push({ linkId: Number(inserted.insertId), url: record.url });
        return { record: { ...record, alias }, alreadyImported: false };
      },
    );
    const importCreated = results.filter(
      (result, index) => result.status === "fulfilled" && usesImportAllowance[index],
    ).length;
    return { results, steps, importCreated };
  };

  const primary = await createLinks(validated);

  // Bitly codes of custom links come after every row's own link, so they never
  // take allowance a row needs, and only for rows whose link exists.
  const codeLinks = primary.results.flatMap((result, index): ImportLink[] => {
    const code = codeOf(index);
    if (!code || result.status === "rejected") return [];
    const { record } = result.value;
    return [
      {
        row: record.row,
        url: record.url,
        domain: record.domain,
        alias: code,
        name: record.name,
        note: `Bitly code for ${rows[index]!.bitly?.shortLink}`.slice(0, 255),
      },
    ];
  });
  const codes = await createLinks(
    await settleWithConcurrency(codeLinks, CSV_IMPORT_CONCURRENCY, prepare),
  );

  const failures = [
    ...primary.results.flatMap((result, index) =>
      result.status === "rejected"
        ? [{ row: records[index]!.row, reason: importErrorMessage(result) }]
        : [],
    ),
    ...codes.results.flatMap((result, index) => {
      if (result.status === "fulfilled") return [];
      const { row, domain, alias } = codeLinks[index]!;
      return [
        {
          row,
          reason: `Bitly code ${domain}/${alias} not kept: ${importErrorMessage(result)}`,
        },
      ];
    }),
  ].sort((a, b) => a.row - b.row);

  const outcomes = [...primary.results, ...codes.results].flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const alreadyImported = outcomes.filter((outcome) => outcome.alreadyImported).length;
  const created = outcomes.length - alreadyImported;
  const importCreated = primary.importCreated + codes.importCreated;

  const notices = primary.results.flatMap((result) => {
    if (result.status === "rejected" || result.value.alreadyImported) return [];
    const { record } = result.value;
    if (!record.movedFrom) return [];
    const backHalf = record.unavailableAlias
      ? `, and the back-half ${record.unavailableAlias} isn't available here`
      : "";
    return [
      {
        row: record.row,
        message: `${record.movedFrom} links stay on Bitly${backHalf}. Created ${record.domain}/${record.alias}.`,
      },
    ];
  });

  // Each unconnected domain once, besides the error on each of its rows.
  const domainNotices = isBitlyFile
    ? [
        ...new Set(
          records.flatMap((record) => {
            const error = domainErrors.get(record.domain);
            return error instanceof Error ? [error.message] : [];
          }),
        ),
      ]
    : [];

  await recordLinkCreationFailures(
    ctx.db,
    "bulk",
    ctx.auth.userId,
    [primary, codes].flatMap(({ results, steps }) =>
      results.flatMap((result, index) =>
        result.status === "rejected"
          ? [classifyLinkCreationError(steps[index] ?? "validation", result.reason)]
          : [],
      ),
    ),
  );

  if (created > importCreated) {
    await incrementWorkspaceLinkCount(ctx, currentCount, limit, created - importCreated);
  }
  await incrementCustomDomainImportCount(ctx, importCreated);
  checkCampaignPatternsAfterResponse(createdDestinations);

  const importAllowanceRemaining = importAllowanceLeft - importCreated;
  const importNotice =
    importCreated > 0
      ? `. ${importCreated.toLocaleString()} on your custom domain used the one-time import allowance instead of your monthly limit (${importAllowanceRemaining.toLocaleString()} of ${CUSTOM_DOMAIN_IMPORT_ALLOWANCE.toLocaleString()} left)`
      : "";

  const summary = [
    `${created} ${created === 1 ? "link" : "links"} created`,
    `${failures.length} failed`,
    ...(alreadyImported > 0 ? [`${alreadyImported} already imported`] : []),
    ...(skipped > 0 ? [`${skipped} skipped (deleted in Bitly)`] : []),
  ];

  return {
    success: true,
    created,
    failed: failures.length,
    skipped,
    alreadyImported,
    failures,
    notices,
    domainNotices,
    importAllowanceUsed: importCreated,
    importAllowanceRemaining,
    message: `${summary.join(", ")}${importNotice}`,
  };
};

export const exportAllUserLinks = async (ctx: WorkspaceTRPCContext) => {
  return ctx.db.query.link.findMany({
    columns: {
      url: true,
      alias: true,
      note: true,
      domain: true,
      createdAt: true,
    },
    where: (table) =>
      and(
        workspaceFilter(ctx.workspace, table.userId, table.teamId),
        eq(table.isQrCode, false),
        eq(table.isBioLink, false),
      ),
  });
};

export const toggleArchive = async (ctx: WorkspaceTRPCContext, input: ToggleArchiveInput) => {
  const currentLink = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
    columns: { archived: true },
  });

  if (!currentLink) {
    throw new Error("Link not found or you don't have permission to modify it.");
  }

  const newArchivedStatus = !currentLink.archived;

  await ctx.db
    .update(link)
    .set({ archived: newArchivedStatus })
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

  // Invalidate cache if necessary (if the link was cached)
  // Consider if archived links should be cached differently or not at all
  // For simplicity, let's remove it for now
  // await deleteFromCache(buildCacheKey(link.domain, link.alias)); // Need domain/alias

  return { success: true, archived: newArchivedStatus };
};

export const getStats = async (ctx: WorkspaceTRPCContext) => {
  const baseFilter = and(
    workspaceFilter(ctx.workspace, link.userId, link.teamId),
    eq(link.isQrCode, false),
    eq(link.isBioLink, false),
  );

  const [result] = await ctx.db
    .select({
      totalLinks: count(),
      activeLinks: count(sql`CASE WHEN ${link.archived} = false THEN 1 END`),
    })
    .from(link)
    .where(baseFilter);

  return {
    totalLinks: result?.totalLinks ?? 0,
    activeLinks: result?.activeLinks ?? 0,
  };
};

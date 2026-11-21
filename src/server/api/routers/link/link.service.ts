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
import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { bucketKey, resolveRangeWindow, summarizeArchived } from "@/lib/core/analytics";
import { formatReferrerLabel } from "@/lib/core/analytics/referrer";
import { parseDeviceDetails } from "@/lib/core/analytics/visitor";
import {
  buildCacheKey,
  deleteFromCache,
  deleteGeoRulesFromCache,
  getFromCache,
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
import { recordClick } from "@/middlewares/record-click";
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
import {
  classifyLinkCreationError,
  recordLinkCreationFailures,
  trackLinkCreation,
} from "@/server/lib/link-creation/failures";
import { scrapeMetadata } from "@/server/lib/metadata";
import { assertUrlSafe } from "@/server/lib/phishing";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";
import {
  generateUnreservedAlias,
  isAliasReserved,
  reserveLinkAliases,
} from "@/server/lib/reserved-alias";
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
} from "@/server/lib/workspace";

import { mergeCampaignUtm } from "../campaign/utils";
import { associateTagsWithLink, getTagsForLink } from "../tag/tag.service";
import {
  assertDomainAllowed,
  checkWorkspaceLinkLimit,
  escapeLikePattern,
  getWorkspaceDefaultDomain,
  incrementWorkspaceLinkCount,
  parseLinkCsv,
  PASSWORD_ATTEMPTS_PER_IP,
  PASSWORD_ATTEMPTS_PER_LINK,
  readAttemptWindow,
  recordFailedAttempt,
  restrictedLinkValues,
  settleWithConcurrency,
  toPublicLink,
  checkAliasAvailability as assertAliasAvailable,
  validateAlias,
} from "./utils";

import type { PublicTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type {
  BulkArchiveLinksInput,
  BulkToggleLinkStatusInput,
  CreateLinkInput,
  GetLinkInput,
  ListLinksInput,
  QuickLinkShorteningInput,
  RetrieveOriginalUrlInput,
  ToggleArchiveInput,
  UpdateLinkInput,
  VerifyLinkPasswordInput,
} from "./link.input";
import type { Link } from "@/server/db/schema";
import type { LinkCreationAttempt, LinkCreationStep } from "@/server/lib/link-creation/failures";
import type { ScrapedMetadata } from "@/server/lib/metadata";

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
      creatorMap = new Map(creators.map((c) => [c.id, c]));
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
  checkUrl?: (url: string) => Promise<void>;
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
  await checkUrl(input.url);

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

  return result;
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

  // Use workspace plan - team workspaces have Ultra features
  const workspacePlan = ctx.workspace.plan;
  const isPaidUser = workspacePlan !== "free";

  // Re-scan only when the destination actually changes: the check can reach
  // Safe Browsing / Web Risk and an LLM, and the current URL already passed it.
  if (input.url !== undefined && input.url !== existingLink.url) {
    await assertUrlSafe(input.url);
  }

  // If domain is being changed, it must be platform-owned or a verified
  // custom domain for this workspace.
  if (input.domain !== undefined && input.domain !== existingLink.domain) {
    await assertDomainAllowed(ctx, input.domain);
  }

  // If alias is being changed, validate it
  if (input.alias && input.alias !== existingLink.alias) {
    const domain = input.domain ?? existingLink.domain;
    await validateAlias(ctx, input.alias, domain, isPaidUser);
  } else if (input.domain && input.domain !== existingLink.domain && existingLink.alias) {
    // Moving the alias to another domain claims it there.
    await assertAliasAvailable(ctx, existingLink.alias, input.domain);
  }

  if (input.activateAt && !isPaidUser) {
    throw new Error(
      "Scheduled links are only available on Pro and Ultra plans. Please upgrade to use this feature.",
    );
  }

  // Check for UTM params - Ultra plan only
  if (input.utmParams) {
    const utmParamsValues = Object.values(input.utmParams);
    const hasUtmParams = utmParamsValues.some(
      (value) => value !== undefined && value !== null && value !== "",
    );
    if (hasUtmParams) {
      if (workspacePlan !== "ultra") {
        throw new Error(
          "UTM parameters are only available on the Ultra plan. Please upgrade to use this feature.",
        );
      }
    }
  }

  // Check for link cloaking - Ultra plan only
  if (input.cloaking) {
    if (workspacePlan !== "ultra") {
      throw new Error(
        "Link cloaking is only available on the Ultra plan. Please upgrade to use this feature.",
      );
    }
  }

  // Downgrades are caught again at token-issuance time in resolveShortLink, so a
  // stale `verifiedClicksEnabled=true` doesn't produce tokens for free users.
  if (input.verifiedClicksEnabled) assertCanEnableVerifiedClicks(workspacePlan);

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
  const { tags: tagNames, geoRules: geoRulesInput, ...linkData } = input;

  if (geoRulesInput !== undefined && geoRulesInput.length > 0) {
    if (!canUseGeoRules(workspacePlan)) {
      throw new Error(
        "Targeting rules are only available on Pro and Ultra plans. Please upgrade to use this feature.",
      );
    }

    const geoLimit = getGeoRulesLimit(workspacePlan);
    if (
      !isUnlimitedGeoRules(workspacePlan) &&
      geoLimit !== undefined &&
      geoRulesInput.length > geoLimit
    ) {
      throw new Error(
        `Your plan allows a maximum of ${geoLimit} targeting rules per link. Please upgrade to Ultra for unlimited rules.`,
      );
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
  const freesOldAlias =
    (!!input.alias && normalizeAlias(input.alias) !== normalizeAlias(existingLink.alias ?? "")) ||
    (!!input.domain && input.domain.toLowerCase() !== existingLink.domain.toLowerCase());

  // One transaction: tags are replaced by delete-then-insert, so a failure
  // part-way must not leave the link without its previous tags.
  await ctx.db.transaction(async (tx) => {
    // A rename frees the old alias just like a delete does.
    if (freesOldAlias) {
      await reserveLinkAliases(tx, linkWhere, "deleted");
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

  // If alias or domain changed, delete the OLD cache key (existingLink has the old values)
  if (existingLink.alias !== updatedLink.alias || existingLink.domain !== updatedLink.domain) {
    await deleteFromCache(buildCacheKey(existingLink.domain, existingLink.alias!));
  }
  // Always set the new cache entry with updated values
  await setInCache(buildCacheKey(updatedLink.domain, updatedLink.alias!), updatedLinkWithTags);
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

  // Delete OG image from R2 if present
  const ogImage = storedOgImage(linkToDelete.metadata);
  if (ogImage) {
    try {
      await deleteImage(ctx.workspace, ogImage);
    } catch (error) {
      log.error({ err: error, linkId: input.id }, "failed to delete OG image from R2");
    }
  }

  await ctx.db.delete(linkMilestone).where(eq(linkMilestone.linkId, input.id));

  const where = and(
    eq(link.id, input.id),
    workspaceFilter(ctx.workspace, link.userId, link.teamId),
  );
  await Promise.all([
    deleteFromCache(buildCacheKey(linkToDelete.domain, linkToDelete.alias!)),
    ctx.db.transaction(async (tx) => {
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
  db: PublicTRPCContext["db"],
  input: Pick<RetrieveOriginalUrlInput, "alias" | "domain">,
) => {
  const { alias, domain } = input;
  const cached = await getFromCache(buildCacheKey(domain, alias));
  if (cached?.alias) return cached;

  const found = await db.query.link.findFirst({
    where: (table, { eq, and, sql }) =>
      and(sql`lower(${table.alias}) = lower(${alias})`, eq(table.domain, domain)),
  });
  if (!found) return null;

  await setInCache(buildCacheKey(found.domain, found.alias!), found);
  return found;
};

export const retrieveOriginalUrl = async (
  ctx: PublicTRPCContext,
  input: RetrieveOriginalUrlInput,
) => {
  const found = await findLinkByAlias(ctx.db, input);
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

  const domain = await getWorkspaceDefaultDomain(ctx);
  // The saved default can outlive the domain (deleted, or never verified)
  await assertDomainAllowed(ctx, domain);
  const alias = await generateUnreservedAlias(ctx.db, domain);

  attempt.step = "safety";
  await assertUrlSafe(input.url);

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

  return {
    id: result.insertId,
    alias,
    domain,
  };
};

export const getLinkVisits = async (
  ctx: WorkspaceTRPCContext,
  input: { id: string; domain?: string; range: string },
) => {
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

  let range = input.range;

  // Enforce 7-day limit for free users
  if (!userHasPaidPlan && !["24h", "7d"].includes(range)) {
    range = "7d";
  }

  const window = resolveRangeWindow(range, new Date());
  const startDate = window.from ?? new Date(0);
  const now = window.to;

  // Previous-period window for % delta: same duration immediately before
  // the current window. Skip for "all" and for inverted windows that can
  // arise from calendar ranges landing on a non-positive duration.
  const windowMs = now.getTime() - startDate.getTime();
  const hasPreviousPeriod = range !== "all" && windowMs > 0;
  const prevEnd = startDate;
  const prevStart = new Date(startDate.getTime() - windowMs);

  const [totalVisits, uniqueVisits, linkGeoRules, prevCounts, summaries, prevSummaries] =
    await Promise.all([
      ctx.db.query.linkVisit.findMany({
        where: (visit, { eq, and, gte, lte }) =>
          and(
            eq(visit.linkId, foundLink.id),
            gte(visit.createdAt, startDate),
            lte(visit.createdAt, now),
          ),
      }),
      ctx.db.query.uniqueLinkVisit.findMany({
        where: (visit, { eq, and, gte, lte }) =>
          and(
            eq(visit.linkId, foundLink.id),
            gte(visit.createdAt, startDate),
            lte(visit.createdAt, now),
          ),
      }),
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
      ctx.db.query.linkVisitDailySummary.findMany({
        where: (s, { eq, and, gte, lte }) =>
          and(
            eq(s.linkId, foundLink.id),
            gte(s.date, bucketKey(startDate)),
            lte(s.date, bucketKey(now)),
          ),
      }),
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
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasPaidPlan,
      geoRules: linkGeoRules,
      previous,
      archived,
      domain,
      range,
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
  const topReferrer = Object.entries(referrerVisits).reduce(
    (a, b) => (a[1] > b[1] ? a : b),
    ["", 0],
  )[0];

  return {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers: referrerVisits,
    topReferrer: formatReferrerLabel(topReferrer),
    isProPlan: userHasPaidPlan,
    geoRules: linkGeoRules,
    previous,
    archived,
    domain,
    range,
    window,
  };
};

export const getAllUserAnalytics = async (
  ctx: WorkspaceTRPCContext,
  input: {
    range: string;
    filterType: "all" | "folder" | "domain" | "link" | "campaign";
    filterId?: string | number;
  },
) => {
  // Use workspace plan - team workspaces inherit Ultra features
  const plan = ctx.workspace.plan;
  const userHasPaidPlan = plan !== "free";

  const range = !userHasPaidPlan && !["24h", "7d"].includes(input.range) ? "7d" : input.range;
  const window = resolveRangeWindow(range, new Date());
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
    range,
    window,
  };

  // Fetch workspace links with optional filtering
  const userLinks = await ctx.db.query.link.findMany({
    where: (table, { eq, and, isNull }) => {
      const conditions = [
        workspaceFilter(ctx.workspace, table.userId, table.teamId),
        eq(table.isQrCode, false),
        eq(table.isBioLink, false),
      ];

      // Apply filter based on type
      if (input.filterType === "folder" && input.filterId !== undefined) {
        if (input.filterId === "null" || input.filterId === null) {
          conditions.push(isNull(table.folderId));
        } else {
          conditions.push(eq(table.folderId, Number(input.filterId)));
        }
      } else if (input.filterType === "domain" && input.filterId) {
        conditions.push(eq(table.domain, String(input.filterId)));
      } else if (input.filterType === "link" && input.filterId) {
        conditions.push(eq(table.id, Number(input.filterId)));
      } else if (input.filterType === "campaign" && input.filterId) {
        conditions.push(eq(table.campaignId, Number(input.filterId)));
      }

      return and(...conditions);
    },
  });

  if (userLinks.length === 0) {
    return empty;
  }

  const linkIds = userLinks.map((link) => link.id);

  // Fetch all visits for all links, plus the per-day counts archived from
  // visits past the retention window (summed in SQL, so one row per day).
  const [totalVisits, uniqueVisits, summaries] = await Promise.all([
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
  ]);

  const archived = summarizeArchived(summaries);

  if (totalVisits.length === 0) {
    return { ...empty, archived };
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
  const topReferrer =
    Object.entries(referrerVisits).length > 0
      ? Object.entries(referrerVisits).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
      : "null";

  return {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers: referrerVisits,
    topReferrer: formatReferrerLabel(topReferrer),
    isProPlan: userHasPaidPlan,
    clicksByLink,
    clicksByDestination,
    archived,
    range,
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

  await ctx.db.delete(linkVisit).where(eq(linkVisit.linkId, fetchedLink.id));

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
  const [existingLink, reserved] = await Promise.all([
    ctx.db.query.link.findFirst({
      columns: { id: true },
      where: (table, { eq, and }) =>
        and(eq(table.alias, input.alias), eq(table.domain, input.domain)),
    }),
    isAliasReserved(ctx.db, input.alias, input.domain),
  ]);

  return { isAvailable: !existingLink && !reserved };
};

// Alias checks, URL scans and inserts each hold a db connection or an outbound
// request; cap them so a 1,000-row file doesn't fan out all at once.
const CSV_IMPORT_CONCURRENCY = 8;

// `checkUrl` is a seam for tests; callers use the default.
export const bulkCreateLinks = (
  ctx: WorkspaceTRPCContext,
  csvContent: string,
  checkUrl: (url: string) => Promise<void> = assertUrlSafe,
) =>
  // Records failures that reject the whole import; per-row failures are recorded below.
  trackLinkCreation(ctx.db, "bulk", ctx.auth.userId, () =>
    bulkCreateLinkRows(ctx, csvContent, checkUrl),
  );

const bulkCreateLinkRows = async (
  ctx: WorkspaceTRPCContext,
  csvContent: string,
  checkUrl: (url: string) => Promise<void>,
) => {
  const rows = parseLinkCsv(csvContent);

  // Throws when the monthly allowance is already used up, rejecting the whole import.
  const { plan, currentCount, limit } = await checkWorkspaceLinkLimit(ctx);
  const isPaidPlan = plan !== "free";
  const remaining = limit === undefined ? Number.POSITIVE_INFINITY : limit - currentCount;

  const records = rows.map((row) => ({
    ...row,
    domain: row.domain ?? DEFAULT_PLATFORM_DOMAIN,
  }));

  // One ownership lookup per distinct domain, not per row.
  const domainErrors = new Map<string, unknown>();
  await settleWithConcurrency(
    [...new Set(records.map((record) => record.domain))],
    CSV_IMPORT_CONCURRENCY,
    async (domain) => {
      try {
        await assertDomainAllowed(ctx, domain);
        domainErrors.set(domain, null);
      } catch (error) {
        domainErrors.set(domain, error);
      }
    },
  );

  // Two rows claiming the same alias on the same domain would otherwise race on
  // the unique index; the first one in the file wins.
  const seenAliases = new Set<string>();
  const validated = await settleWithConcurrency(records, CSV_IMPORT_CONCURRENCY, async (row) => {
    if (!row.url) throw new TRPCError({ code: "BAD_REQUEST", message: "Missing url" });
    const url = normalizeDestinationUrl(row.url);
    if (!url) throw new TRPCError({ code: "BAD_REQUEST", message: INVALID_URL_MESSAGE });
    const record = { ...row, url };
    const domainError = domainErrors.get(record.domain);
    if (domainError) throw domainError;
    if (!record.alias) return record;

    const aliasKey = `${record.domain.toLowerCase()}/${normalizeAlias(record.alias)}`;
    if (seenAliases.has(aliasKey)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Alias is used by an earlier row in this file",
      });
    }
    seenAliases.add(aliasKey);

    await validateAlias(ctx, record.alias, record.domain, isPaidPlan);
    return record;
  });

  // Allowance goes to valid rows in file order, before the (slow) URL safety
  // scan, so rows past the limit are never scanned.
  let allotted = 0;
  const rowSteps = validated.map((): LinkCreationStep => "validation");
  const results = await settleWithConcurrency(
    validated,
    CSV_IMPORT_CONCURRENCY,
    async (check, index) => {
      if (check.status === "rejected") throw check.reason;
      if (allotted >= remaining) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Monthly limit of ${limit?.toLocaleString()} links reached. Upgrade your plan to create more.`,
        });
      }
      allotted++;

      const record = check.value;
      rowSteps[index] = "safety";
      await checkUrl(record.url);

      rowSteps[index] = "db";
      const ownership = workspaceOwnership(ctx.workspace);
      await ctx.db.insert(link).values({
        url: record.url,
        alias: record.alias ?? (await generateUnreservedAlias(ctx.db, record.domain)),
        userId: ownership.userId,
        teamId: ownership.teamId,
        createdByUserId: ctx.auth.userId, // Track the actual user who created the link
        domain: record.domain,
        note: record.note,
        ...restrictedLinkValues(ctx.restrictedAt),
      });
    },
  );

  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          {
            row: records[index]!.row,
            reason:
              result.reason instanceof Error ? result.reason.message : "Could not create this link",
          },
        ]
      : [],
  );
  const created = results.length - failures.length;

  await recordLinkCreationFailures(
    ctx.db,
    "bulk",
    ctx.auth.userId,
    results.flatMap((result, index) =>
      result.status === "rejected"
        ? [classifyLinkCreationError(rowSteps[index] ?? "validation", result.reason)]
        : [],
    ),
  );

  if (created > 0) {
    await incrementWorkspaceLinkCount(ctx, currentCount, limit, created);
  }

  return {
    success: true,
    created,
    failed: failures.length,
    failures,
    message: `${created} ${created === 1 ? "link" : "links"} created, ${failures.length} failed`,
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

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { endOfYear, startOfMonth, startOfYear, subDays } from "date-fns";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";

import { resolvePlan } from "@/lib/billing/plans";
import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { deleteFromCache, getFromCache, setInCache } from "@/lib/core/cache";
import { generateShortLink } from "@/lib/core/links";
import { fetchMetadataInfo } from "@/lib/utils/fetch-link-metadata";
import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { db } from "@/server/db";
import { link, linkTag, linkVisit, qrcode, tag, uniqueLinkVisit, user } from "@/server/db/schema";
import { folder } from "@/server/db/schema";
import { deleteImage, uploadImage } from "@/server/lib/storage";
import {
  getAccessibleFolderIds,
  isWorkspaceAdmin,
  requireFolderAccess,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import { associateTagsWithLink, getTagsForLink } from "../tag/tag.service";

import {
  checkWorkspaceLinkLimit,
  getWorkspaceDefaultDomain,
  incrementWorkspaceLinkCount,
  validateAlias,
} from "./utils";

import type { Link } from "@/server/db/schema";
import type { ProtectedTRPCContext, PublicTRPCContext, WorkspaceTRPCContext } from "../../trpc";
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
} from "./link.input";

function constructCacheKey(domain: string, alias: string) {
  return `${domain}:${alias}`;
}

export const getLinks = async (ctx: WorkspaceTRPCContext, input: ListLinksInput) => {
  const { page, pageSize, orderBy, orderDirection, tag: tagName, archivedFilter, search } = input;
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

  // Base query condition - use workspace filtering
  let baseCondition = and(workspaceFilter(ctx.workspace, link.userId, link.teamId));

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
    };
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
    const searchLower = `%${search.trim().toLowerCase()}%`;
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

  // Prepare the query parts
  const linksQuery = ctx.db
    .select({
      ...getTableColumns(link),
      totalClicks: count(linkVisit.id).as("total_clicks"),
    })
    .from(link)
    .leftJoin(linkVisit, eq(link.id, linkVisit.linkId))
    .where(baseCondition)
    .groupBy(link.id)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Apply ordering based on the orderBy parameter
  if (orderBy === "totalClicks") {
    linksQuery.orderBy(orderFunc(count(linkVisit.id)));
  } else if (orderBy === "lastClicked") {
    linksQuery.orderBy(orderFunc(sql`MAX(${linkVisit.createdAt})`));
  } else {
    linksQuery.orderBy(orderFunc(link.createdAt));
  }

  const [totalLinksResult, totalClicksResult, links] = await Promise.all([
    ctx.db.select({ count: count() }).from(link).where(baseCondition),
    ctx.db
      .select({ totalClicks: count(linkVisit.id) })
      .from(linkVisit)
      .innerJoin(link, eq(link.id, linkVisit.linkId))
      .where(workspaceFilter(ctx.workspace, link.userId, link.teamId)),
    linksQuery,
  ]);

  // Batch fetch creator info for team workspaces (avoid N+1)
  let creatorMap: Map<string, { id: string; name: string | null; imageUrl: string | null }> =
    new Map();
  if (ctx.workspace.type === "team") {
    const creatorIds = [
      ...new Set(links.map((l) => l.createdByUserId).filter(Boolean)),
    ] as string[];
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
  const totalClicks = totalClicksResult?.[0]?.totalClicks ?? 0;

  return {
    links: linksWithTags,
    totalLinks,
    totalClicks,
    currentPage: page,
    totalPages: Math.ceil(totalLinks / pageSize),
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

export const getLinkByAlias = async (input: {
  alias: string;
  domain: string;
}) => {
  return db
    .select()
    .from(link)
    .where(and(eq(link.domain, input.domain), sql`lower(${link.alias}) = lower(${input.alias})`));
};

export const createLink = async (ctx: WorkspaceTRPCContext, input: CreateLinkInput) => {
  const { plan, currentCount, limit } = await checkWorkspaceLinkLimit(ctx);
  const isPaidPlan = plan !== "free";

  const domain = input.domain ?? "ishortn.ink";
  const alias = input.alias && input.alias !== "" ? input.alias : await generateShortLink();

  const fetchedMetadata = await fetchMetadataInfo(input.url);
  const phishingResult = await detectPhishingLink(input.url, fetchedMetadata);

  if (phishingResult.phishing) {
    throw new Error(
      "This URL has been detected as a potential phishing site. Shortening will not continue.",
    );
  }

  if (input.alias) {
    await validateAlias(ctx, input.alias, domain, isPaidPlan);
  }

  if (input.password) {
    if (!isPaidPlan) {
      throw new Error("You need to upgrade to a pro plan to use password protection");
    }

    input.password = await bcrypt.hash(input.password, 10);
  }

  const inputMetaData = input.metadata;
  const metadataValues = Object.values(inputMetaData ?? {});
  const hasUserFilledMetadata = metadataValues.some(
    (value) => value !== undefined && value !== null && value !== "",
  );
  if (hasUserFilledMetadata) {
    if (!isPaidPlan) {
      throw new Error("You need to upgrade to a pro plan to use custom social media previews");
    }
  }

  // Check for UTM params - Ultra plan only
  const utmParamsValues = Object.values(input.utmParams ?? {});
  const hasUtmParams = utmParamsValues.some(
    (value) => value !== undefined && value !== null && value !== "",
  );
  if (hasUtmParams) {
    if (plan !== "ultra") {
      throw new Error(
        "UTM parameters are only available on the Ultra plan. Please upgrade to use this feature.",
      );
    }
  }

  // Check for link cloaking - Ultra plan only
  if (input.cloaking) {
    if (plan !== "ultra") {
      throw new Error(
        "Link cloaking is only available on the Ultra plan. Please upgrade to use this feature.",
      );
    }
  }

  input.metadata = {
    title: inputMetaData?.title ?? fetchedMetadata.title,
    description: inputMetaData?.description ?? fetchedMetadata.description,
    image: inputMetaData?.image ?? fetchedMetadata.image,
  };

  const name = input.name ?? fetchedMetadata.title ?? "Untitled Link";
  const tagNames = input.tags ?? [];

  // Create link without tags field
  const { tags, ...linkData } = input;
  const ownership = workspaceOwnership(ctx.workspace);
  const [result] = await ctx.db.insert(link).values({
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
  });

  // Associate tags with the link
  const linkId = Number(result.insertId);
  if (tagNames.length > 0) {
    await associateTagsWithLink(ctx, linkId, tagNames);
  }

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
      console.error("Failed to upload OG image:", error);
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

  // If alias is being changed, validate it
  if (input.alias && input.alias !== existingLink.alias) {
    const domain = input.domain ?? existingLink.domain;
    await validateAlias(ctx, input.alias, domain, isPaidUser);
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

  // Extract tags from input
  const { tags: tagNames, ...linkData } = input;

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
      console.error("Failed to upload OG image:", error);
      // Continue with the original image (base64 or URL) if upload fails
    }
  }

  // Update link data - use workspace filtering
  await ctx.db
    .update(link)
    .set(linkData)
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

  // Update tags if provided
  if (tagNames) {
    await associateTagsWithLink(ctx, input.id, tagNames);
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
    await deleteFromCache(constructCacheKey(existingLink.domain, existingLink.alias!));
  }
  // Always set the new cache entry with updated values
  await setInCache(constructCacheKey(updatedLink.domain, updatedLink.alias!), updatedLinkWithTags);
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
  const metadata = linkToDelete.metadata as { image?: string } | null;
  if (metadata?.image) {
    try {
      await deleteImage(metadata.image);
    } catch (error) {
      console.error("Failed to delete OG image from R2:", error);
    }
  }

  await Promise.all([
    deleteFromCache(constructCacheKey(linkToDelete.domain, linkToDelete.alias!)),
    ctx.db
      .delete(link)
      .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId))),
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
    const metadata = l.metadata as { image?: string } | null;
    if (metadata?.image) {
      try {
        await deleteImage(metadata.image);
      } catch (error) {
        console.error(`Failed to delete OG image for link ${l.id}:`, error);
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

    // 5. Finally delete the links themselves
    await tx.delete(link).where(inArray(link.id, validLinkIds));
  });

  // Invalidate cache for all deleted links (async, don't block)
  void Promise.all(
    linksToDelete.map((l) => deleteFromCache(constructCacheKey(l.domain, l.alias!))),
  ).catch((err) => {
    console.error("Failed to invalidate cache for deleted links:", err);
  });

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

  return { success: true, count: linksToUpdate.length, disabled: disable };
};

export const retrieveOriginalUrl = async (
  ctx: PublicTRPCContext,
  input: RetrieveOriginalUrlInput,
) => {
  const { alias, domain } = input;
  const cacheKey = `${domain}:${alias}`;

  let link: Link | undefined | null = await getFromCache(cacheKey);

  if (!link?.alias) {
    link = await ctx.db.query.link.findFirst({
      where: (table, { eq, and, sql }) =>
        and(sql`lower(${table.alias}) = lower(${input.alias})`, eq(table.domain, domain)),
    });

    if (!link) {
      return null;
    }

    await setInCache(`${link.domain}:${link.alias}`, link);
  }

  // waitUntil(logAnalytics(ctx, link, input.from));

  return link;
};

export const shortenLinkWithAutoAlias = async (
  ctx: WorkspaceTRPCContext,
  input: QuickLinkShorteningInput,
) => {
  const { currentCount, limit } = await checkWorkspaceLinkLimit(ctx);

  const alias = await generateShortLink();
  const domain = await getWorkspaceDefaultDomain(ctx);

  const fetchedMetadata = await fetchMetadataInfo(input.url);
  const phishingResult = await detectPhishingLink(input.url, fetchedMetadata);

  if (phishingResult.phishing) {
    throw new Error(
      "This URL has been detected as a potential phishing site. Shortening will not continue.",
    );
  }

  const name = fetchedMetadata.title ?? "Untitled Link";
  const tagNames = input.tags ?? [];
  const ownership = workspaceOwnership(ctx.workspace);

  // Create link without tags field
  const [result] = await ctx.db.insert(link).values({
    url: input.url,
    alias,
    domain,
    userId: ownership.userId,
    teamId: ownership.teamId,
    createdByUserId: ctx.auth.userId, // Track the actual user who created the link
    name,
    metadata: {
      title: fetchedMetadata.title,
      description: fetchedMetadata.description,
      image: fetchedMetadata.image,
    },
  });

  // Associate tags with the link
  if (tagNames.length > 0) {
    await associateTagsWithLink(ctx, Number(result.insertId), tagNames);
  }

  await incrementWorkspaceLinkCount(ctx, currentCount, limit);

  return {
    id: result.insertId,
    alias,
    domain,
  };
};

export const getLinkVisits = async (
  ctx: WorkspaceTRPCContext,
  input: { id: string; domain: string; range: string },
) => {
  // Use workspace plan - team workspaces inherit Ultra features
  const plan = ctx.workspace.plan;
  const userHasPaidPlan = plan !== "free";

  // Use workspace filtering to ensure the link belongs to the current workspace
  const foundLink = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.alias, input.id),
      eq(link.domain, input.domain),
      workspaceFilter(ctx.workspace, link.userId, link.teamId),
    ),
  });

  if (!foundLink) {
    return {
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasPaidPlan,
    };
  }

  let now = new Date();
  let startDate: Date;
  let range = input.range;

  // Enforce 7-day limit for free users
  if (!userHasPaidPlan && !["24h", "7d"].includes(range)) {
    range = "7d";
  }

  switch (range) {
    case "24h":
      startDate = subDays(now, 1);
      break;
    case "7d":
      startDate = subDays(now, 7);
      break;
    case "30d":
      startDate = subDays(now, 30);
      break;
    case "90d":
      startDate = subDays(now, 90);
      break;
    case "this_month":
      startDate = startOfMonth(now);
      break;
    case "last_month":
      startDate = startOfMonth(subDays(now, 30));
      now.setDate(0); // Set to last day of previous month
      break;
    case "this_year":
      startDate = startOfYear(now);
      break;
    case "last_year":
      startDate = startOfYear(subDays(now, 365));
      now = endOfYear(subDays(now, 365));
      break;
    case "all":
      startDate = new Date(0); // Beginning of time
      break;
    default:
      startDate = subDays(now, 7); // Default to last 7 days
  }

  const [totalVisits, uniqueVisits] = await Promise.all([
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
  ]);

  if (totalVisits.length === 0) {
    return {
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasPaidPlan,
    };
  }

  const countryVisits = totalVisits.reduce(
    (acc, visit) => {
      // Skip null/undefined country values
      if (visit.country) {
        acc[visit.country] = (acc[visit.country] ?? 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
  const topCountry = Object.entries(countryVisits).reduce(
    (a, b) => (a[1] > b[1] ? a : b),
    ["", 0],
  )[0];

  const referrerVisits = totalVisits.reduce(
    (acc, visit) => {
      // Skip null/undefined referer values
      if (visit.referer) {
        acc[visit.referer] = (acc[visit.referer] ?? 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
  const topReferrer = Object.entries(referrerVisits).reduce(
    (a, b) => (a[1] > b[1] ? a : b),
    ["", 0],
  )[0];

  return {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers: referrerVisits,
    topReferrer: topReferrer !== "null" ? topReferrer : "Direct",
    isProPlan: userHasPaidPlan,
  };
};

export const getAllUserAnalytics = async (
  ctx: WorkspaceTRPCContext,
  input: {
    range: string;
    filterType: "all" | "folder" | "domain" | "link";
    filterId?: string | number;
  },
) => {
  // Use workspace plan - team workspaces inherit Ultra features
  const plan = ctx.workspace.plan;
  const userHasPaidPlan = plan !== "free";

  // Fetch workspace links with optional filtering
  const userLinks = await ctx.db.query.link.findMany({
    where: (table, { eq, and, isNull }) => {
      const conditions = [workspaceFilter(ctx.workspace, table.userId, table.teamId)];

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
      }

      return and(...conditions);
    },
  });

  if (userLinks.length === 0) {
    return {
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasPaidPlan,
      clicksByLink: {},
      clicksByDestination: {},
    };
  }

  let now = new Date();
  let startDate: Date;
  let range = input.range;

  // Enforce 7-day limit for free users
  if (!userHasPaidPlan && !["24h", "7d"].includes(range)) {
    range = "7d";
  }

  switch (range) {
    case "24h":
      startDate = subDays(now, 1);
      break;
    case "7d":
      startDate = subDays(now, 7);
      break;
    case "30d":
      startDate = subDays(now, 30);
      break;
    case "90d":
      startDate = subDays(now, 90);
      break;
    case "this_month":
      startDate = startOfMonth(now);
      break;
    case "last_month":
      startDate = startOfMonth(subDays(now, 30));
      now.setDate(0);
      break;
    case "this_year":
      startDate = startOfYear(now);
      break;
    case "last_year":
      startDate = startOfYear(subDays(now, 365));
      now = endOfYear(subDays(now, 365));
      break;
    case "all":
      startDate = new Date(0);
      break;
    default:
      startDate = subDays(now, 7);
  }

  const linkIds = userLinks.map((link) => link.id);

  // Fetch all visits for all links
  const [totalVisits, uniqueVisits] = await Promise.all([
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
  ]);

  if (totalVisits.length === 0) {
    return {
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasPaidPlan,
      clicksByLink: {},
      clicksByDestination: {},
    };
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
  const countryVisits = totalVisits.reduce(
    (acc, visit) => {
      if (visit.country) {
        acc[visit.country] = (acc[visit.country] ?? 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
  const topCountry =
    Object.entries(countryVisits).length > 0
      ? Object.entries(countryVisits).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
      : "N/A";

  // Calculate referrers
  const referrerVisits = totalVisits.reduce(
    (acc, visit) => {
      const ref = visit.referer ?? "null";
      acc[ref] = (acc[ref] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const topReferrer =
    Object.entries(referrerVisits).length > 0
      ? Object.entries(referrerVisits).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
      : "null";

  return {
    totalVisits,
    uniqueVisits,
    topCountry,
    referers: referrerVisits,
    topReferrer: topReferrer !== "null" ? topReferrer : "Direct",
    isProPlan: userHasPaidPlan,
    clicksByLink,
    clicksByDestination,
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

  return ctx.db
    .update(link)
    .set({
      disabled: !fetchedLink.disabled,
    })
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));
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
  input: { id: number; password: string },
) => {
  const link = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!link?.passwordHash) {
    return null;
  }

  const isPasswordCorrect = await bcrypt.compare(input.password, link.passwordHash);

  if (!isPasswordCorrect) {
    return null;
  }

  const deviceDetails = await retrieveDeviceAndGeolocationData(ctx.headers);
  const ipHash = crypto
    .createHash("sha256")
    .update(ctx.headers.get("x-forwarded-for") ?? "")
    .digest("hex");
  const existingLinkVisit = await ctx.db.query.uniqueLinkVisit.findFirst({
    where: (table, { eq, and }) => and(eq(table.linkId, link.id), eq(table.ipHash, ipHash)),
  });

  if (!existingLinkVisit) {
    await ctx.db.insert(uniqueLinkVisit).values({
      linkId: link.id,
      ipHash,
    });
  }

  await ctx.db.insert(linkVisit).values({
    linkId: link.id,
    ...deviceDetails,
  });

  return link;
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

  await deleteFromCache(constructCacheKey(updatedLink!.domain, updatedLink!.alias!));

  return updatedLink;
};

export const checkAliasAvailability = async (
  ctx: PublicTRPCContext,
  input: { alias: string; domain: string },
) => {
  const existingLink = await ctx.db.query.link.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.alias, input.alias), eq(table.domain, input.domain)),
  });

  return { isAvailable: !existingLink };
};

type LinkRecord = {
  url: string;
  alias?: string;
  domain?: string;
  note?: string;
};

export const bulkCreateLinks = async (ctx: WorkspaceTRPCContext, csvContent: string) => {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as LinkRecord[];

  const ownership = workspaceOwnership(ctx.workspace);

  // we need to check for alias clashes and report those to the user, if we use promise.all, it will
  // fail if there is an alias clash so we need to use promise.allSettled
  // promise.all settled will return an array of objects with status and value, we can then filter out
  // the rejected promises and report those to the user
  const bulkLinksCreationPromiseResults = await Promise.allSettled(
    records.map(async (record: LinkRecord) => {
      const alias = record.alias ?? (await generateShortLink());
      await ctx.db.insert(link).values({
        url: record.url,
        alias,
        userId: ownership.userId,
        teamId: ownership.teamId,
        createdByUserId: ctx.auth.userId, // Track the actual user who created the link
        domain: record.domain ?? "ishortn.ink",
        note: record.note,
      });
    }),
  );

  const successfulLinks = bulkLinksCreationPromiseResults.filter(
    (result) => result.status === "fulfilled",
  ).length;
  const failedLinks = bulkLinksCreationPromiseResults.filter(
    (result) => result.status === "rejected",
  ).length;

  // TODO: add a way to notify the user about links that failed. We have already added an email template.
  // so we need to filter the links that failed and attach the right reason to the email.

  return {
    success: true,
    message: `${successfulLinks} links created successfully, ${failedLinks} links failed to create`,
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
    where: (table) => workspaceFilter(ctx.workspace, table.userId, table.teamId),
  });
};

export const checkPresenceOfVercelHeaders = async (ctx: PublicTRPCContext) => {
  return {
    headers: ctx.headers,
    countryHeader: ctx.headers.get("x-vercel-ip-country"),
    cityHeader: ctx.headers.get("x-vercel-ip-city"),
  };
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
  // await deleteFromCache(constructCacheKey(link.domain, link.alias)); // Need domain/alias

  return { success: true, archived: newArchivedStatus };
};

export const getStats = async (ctx: WorkspaceTRPCContext) => {
  const [totalLinksResult, activeLinksResult] = await Promise.all([
    ctx.db
      .select({ count: count() })
      .from(link)
      .where(workspaceFilter(ctx.workspace, link.userId, link.teamId)),
    ctx.db
      .select({ count: count() })
      .from(link)
      .where(
        and(workspaceFilter(ctx.workspace, link.userId, link.teamId), eq(link.archived, false)),
      ),
  ]);

  return {
    totalLinks: totalLinksResult?.[0]?.count ?? 0,
    activeLinks: activeLinksResult?.[0]?.count ?? 0,
  };
};

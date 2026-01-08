/**
 * Link CRUD operations
 * Core operations for creating, reading, updating, and deleting links
 */

import bcrypt from "bcryptjs";
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
import QRCode from "qrcode";

import { deleteFromCache, setInCache } from "@/lib/core/cache";
import { generateShortLink } from "@/lib/core/links";
import { fetchMetadataInfo } from "@/lib/utils/fetch-link-metadata";
import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { db } from "@/server/db";
import {
  folder,
  link,
  linkVisit,
  qrcode,
  user,
} from "@/server/db/schema";
import {
  getAccessibleFolderIds,
  isWorkspaceAdmin,
  requireFolderAccess,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import { associateTagsWithLink, getTagsForLink } from "../../tag/tag.service";
import {
  checkWorkspaceLinkLimit,
  getWorkspaceDefaultDomain,
  incrementWorkspaceLinkCount,
  validateAlias,
} from "../utils";
import { constructCacheKey } from "./link-shared";

import type { WorkspaceTRPCContext } from "../../../trpc";
import type {
  CreateLinkInput,
  GetLinkInput,
  ListLinksInput,
  QuickLinkShorteningInput,
  UpdateLinkInput,
} from "../link.input";

export const getLinks = async (
  ctx: WorkspaceTRPCContext,
  input: ListLinksInput
) => {
  const {
    page,
    pageSize,
    orderBy,
    orderDirection,
    tag: tagName,
    archivedFilter,
    search,
  } = input;
  const orderFunc = orderDirection === "desc" ? desc : asc;

  // If filtering by tag, first get the link IDs that have this tag
  let linkIdsWithTag: number[] = [];
  if (tagName && tagName.trim() !== "") {
    // Get tag record - use workspace filtering for tags
    const { tag } = await import("@/server/db/schema");
    const { linkTag } = await import("@/server/db/schema");
    const tagRecord = await ctx.db.query.tag.findFirst({
      where: and(
        eq(tag.name, tagName.trim().toLowerCase()),
        workspaceFilter(ctx.workspace, tag.userId, tag.teamId)
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
      or(
        like(link.name, searchLower),
        like(link.alias, searchLower),
        like(link.url, searchLower)
      )
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
    const accessibleFolderIds = await getAccessibleFolderIds(
      ctx.db,
      ctx.workspace,
      folderIds
    );

    // Filter: links in accessible folders OR links with no folder
    if (accessibleFolderIds.length > 0) {
      baseCondition = and(
        baseCondition,
        or(
          inArray(link.folderId, accessibleFolderIds),
          isNull(link.folderId)
        )
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
  let creatorMap: Map<string, { id: string; name: string | null; imageUrl: string | null }> = new Map();
  if (ctx.workspace.type === "team") {
    const creatorIds = [...new Set(links.map((l) => l.createdByUserId).filter(Boolean))] as string[];
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
      const createdBy = linkItem.createdByUserId ? creatorMap.get(linkItem.createdByUserId) ?? null : null;

      return {
        ...linkItem,
        tags: tagRecords.map((tagRecord) => tagRecord.name),
        folder: folderInfo,
        createdBy,
      };
    })
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

export const getLink = async (
  ctx: WorkspaceTRPCContext,
  input: GetLinkInput
) => {
  const linkData = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, input.id),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
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
    .where(
      and(
        eq(link.domain, input.domain),
        sql`lower(${link.alias}) = lower(${input.alias})`
      )
    );
};

export const createLink = async (
  ctx: WorkspaceTRPCContext,
  input: CreateLinkInput
) => {
  const { plan, currentCount, limit } = await checkWorkspaceLinkLimit(ctx);
  const isPaidPlan = plan !== "free";

  const domain = input.domain ?? "ishortn.ink";
  const alias =
    input.alias && input.alias !== "" ? input.alias : await generateShortLink();

  const fetchedMetadata = await fetchMetadataInfo(input.url);
  const phishingResult = await detectPhishingLink(input.url, fetchedMetadata);

  if (phishingResult.phishing) {
    throw new Error(
      "This URL has been detected as a potential phishing site. Shortening will not continue."
    );
  }

  if (input.alias) {
    await validateAlias(ctx, input.alias, domain, isPaidPlan);
  }

  if (input.password) {
    if (!isPaidPlan) {
      throw new Error(
        "You need to upgrade to a pro plan to use password protection"
      );
    }

    input.password = await bcrypt.hash(input.password, 10);
  }

  const inputMetaData = input.metadata;
  const metadataValues = Object.values(inputMetaData ?? {});
  const hasUserFilledMetadata = metadataValues.some(
    (value) => value !== undefined && value !== null && value !== ""
  );
  if (hasUserFilledMetadata) {
    if (!isPaidPlan) {
      throw new Error(
        "You need to upgrade to a pro plan to use custom social media previews"
      );
    }
  }

  // Check for UTM params - Ultra plan only
  const utmParamsValues = Object.values(input.utmParams ?? {});
  const hasUtmParams = utmParamsValues.some(
    (value) => value !== undefined && value !== null && value !== ""
  );
  if (hasUtmParams) {
    if (plan !== "ultra") {
      throw new Error(
        "UTM parameters are only available on the Ultra plan. Please upgrade to use this feature."
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
  });

  // Associate tags with the link
  if (tagNames.length > 0) {
    await associateTagsWithLink(ctx, Number(result.insertId), tagNames);
  }

  // Auto-generate QR Code
  try {
    const shortUrl = `${domain}/${alias}`;
    const qrCodeDataUrl = await QRCode.toDataURL(shortUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 1024,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    await ctx.db.insert(qrcode).values({
      userId: ownership.userId,
      teamId: ownership.teamId,
      title: name,
      color: "#000000",
      content: shortUrl,
      cornerStyle: "square",
      patternStyle: "square",
      qrCode: qrCodeDataUrl,
      linkId: Number(result.insertId),
      contentType: "link",
    });
  } catch (error) {
    console.error("Failed to auto-generate QR code:", error);
    // Don't fail the link creation if QR generation fails
  }

  await incrementWorkspaceLinkCount(ctx, currentCount, limit);

  return result;
};

export const updateLink = async (
  ctx: WorkspaceTRPCContext,
  input: UpdateLinkInput
) => {
  // Get existing link first
  const existingLink = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, input.id),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
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
      (value) => value !== undefined && value !== null && value !== ""
    );
    if (hasUtmParams) {
      if (workspacePlan !== "ultra") {
        throw new Error(
          "UTM parameters are only available on the Ultra plan. Please upgrade to use this feature."
        );
      }
    }
  }

  // Extract tags from input
  const { tags: tagNames, ...linkDataToUpdate } = input;

  // Update link data - use workspace filtering
  await ctx.db
    .update(link)
    .set(linkDataToUpdate)
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

  // Update tags if provided
  if (tagNames) {
    await associateTagsWithLink(ctx, input.id, tagNames);
  }

  const updatedLink = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, input.id),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
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

  if (
    updatedLink.alias !== input.alias ||
    updatedLink.domain !== input.domain
  ) {
    await deleteFromCache(
      constructCacheKey(updatedLink.domain, updatedLink.alias!)
    );
  }
  await setInCache(
    constructCacheKey(updatedLink.domain, updatedLink.alias!),
    updatedLinkWithTags
  );
};

export const deleteLink = async (
  ctx: WorkspaceTRPCContext,
  input: GetLinkInput
) => {
  const linkToDelete = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, input.id),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (!linkToDelete) {
    return null;
  }

  // Check folder access permission for team members
  if (linkToDelete.folderId) {
    await requireFolderAccess(ctx.db, ctx.workspace, linkToDelete.folderId);
  }

  await Promise.all([
    deleteFromCache(
      constructCacheKey(linkToDelete.domain, linkToDelete.alias!)
    ),
    ctx.db
      .delete(link)
      .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId))),
  ]);
};

export const shortenLinkWithAutoAlias = async (
  ctx: WorkspaceTRPCContext,
  input: QuickLinkShorteningInput
) => {
  const { currentCount, limit } = await checkWorkspaceLinkLimit(ctx);

  const alias = await generateShortLink();
  const domain = await getWorkspaceDefaultDomain(ctx);

  const fetchedMetadata = await fetchMetadataInfo(input.url);
  const phishingResult = await detectPhishingLink(input.url, fetchedMetadata);

  if (phishingResult.phishing) {
    throw new Error(
      "This URL has been detected as a potential phishing site. Shortening will not continue."
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

  // Auto-generate QR Code
  try {
    const shortUrl = `${domain}/${alias}`;
    const qrCodeDataUrl = await QRCode.toDataURL(shortUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 1024,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    await ctx.db.insert(qrcode).values({
      userId: ownership.userId,
      teamId: ownership.teamId,
      title: name,
      color: "#000000",
      content: shortUrl,
      cornerStyle: "square",
      patternStyle: "square",
      qrCode: qrCodeDataUrl,
      linkId: Number(result.insertId),
      contentType: "link",
    });
  } catch (error) {
    console.error("Failed to auto-generate QR code:", error);
    // Don't fail the link creation if QR generation fails
  }

  await incrementWorkspaceLinkCount(ctx, currentCount, limit);

  return {
    id: result.insertId,
    alias,
    domain,
  };
};

export const retrieveOriginalUrl = async (
  ctx: { db: typeof db; headers: Headers },
  input: { alias: string; domain: string }
) => {
  const { alias, domain } = input;
  const cacheKey = `${domain}:${alias}`;
  const { getFromCache } = await import("@/lib/core/cache");

  let foundLink = await getFromCache(cacheKey);

  if (!foundLink?.alias) {
    const dbLink = await ctx.db.query.link.findFirst({
      where: (table, { eq, and, sql }) =>
        and(
          sql`lower(${table.alias}) = lower(${input.alias})`,
          eq(table.domain, domain)
        ),
    });

    if (!dbLink) {
      return null;
    }

    foundLink = dbLink;
    await setInCache(`${foundLink.domain}:${foundLink.alias}`, foundLink);
  }

  return foundLink;
};

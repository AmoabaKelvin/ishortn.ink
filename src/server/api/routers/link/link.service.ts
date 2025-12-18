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
  like,
  or,
  sql
} from "drizzle-orm";
import crypto from "node:crypto";
import QRCode from "qrcode";

import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { resolvePlan } from "@/lib/billing/plans";
import { getUserPlanContext } from "@/server/lib/user-plan";
import { deleteFromCache, getFromCache, setInCache } from "@/lib/core/cache";
import { generateShortLink } from "@/lib/core/links";
import { fetchMetadataInfo } from "@/lib/utils/fetch-link-metadata";
import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { db } from "@/server/db";
import {
  link,
  linkTag,
  linkVisit,
  qrcode,
  tag,
  uniqueLinkVisit
} from "@/server/db/schema";

import { associateTagsWithLink, getTagsForLink } from "../tag/tag.service";

import {
  checkAndUpdateLinkLimit,
  getUserDefaultDomain,
  incrementLinkCount,
  validateAlias
} from "./utils";

import type { Link } from "@/server/db/schema";
import type { ProtectedTRPCContext, PublicTRPCContext } from "../../trpc";
import type {
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

export const getLinks = async (
  ctx: ProtectedTRPCContext,
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
    // Get tag record
    const tagRecord = await ctx.db.query.tag.findFirst({
      where: and(
        eq(tag.name, tagName.trim().toLowerCase()),
        eq(tag.userId, ctx.auth.userId)
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

  // Base query condition
  let baseCondition = and(eq(link.userId, ctx.auth.userId));

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
      .where(eq(link.userId, ctx.auth.userId)),
    linksQuery,
  ]);

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

      return {
        ...linkItem,
        tags: tagRecords.map((tagRecord) => tagRecord.name),
        folder: folderInfo,
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
  ctx: ProtectedTRPCContext,
  input: GetLinkInput
) => {
  return ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });
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
  ctx: ProtectedTRPCContext,
  input: CreateLinkInput
) => {
  const { plan, currentCount, limit } = await checkAndUpdateLinkLimit(ctx);
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
  const [result] = await ctx.db.insert(link).values({
    ...linkData,
    name,
    alias,
    userId: ctx.auth.userId,
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
      userId: ctx.auth.userId,
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

  await incrementLinkCount(ctx, currentCount, limit);

  return result;
};

export const updateLink = async (
  ctx: ProtectedTRPCContext,
  input: UpdateLinkInput
) => {
  // Get existing link first
  const existingLink = await ctx.db.query.link.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.id, input.id), eq(table.userId, ctx.auth.userId)),
  });

  if (!existingLink) {
    throw new Error("Link not found");
  }

  // Get plan context once for both alias and UTM validation
  let planCtx: Awaited<ReturnType<typeof getUserPlanContext>> | null = null;

  // If alias is being changed, validate it
  if (input.alias && input.alias !== existingLink.alias) {
    planCtx = await getUserPlanContext(ctx.auth.userId, ctx.db);
    const isPaidUser = planCtx ? planCtx.plan !== "free" : false;
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
      planCtx = planCtx ?? await getUserPlanContext(ctx.auth.userId, ctx.db);
      if (planCtx?.plan !== "ultra") {
        throw new Error(
          "UTM parameters are only available on the Ultra plan. Please upgrade to use this feature."
        );
      }
    }
  }

  // Extract tags from input
  const { tags: tagNames, ...linkData } = input;

  // Update link data
  await ctx.db
    .update(link)
    .set(linkData)
    .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));

  // Update tags if provided
  if (tagNames) {
    await associateTagsWithLink(ctx, input.id, tagNames);
  }

  const updatedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
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
  ctx: ProtectedTRPCContext,
  input: GetLinkInput
) => {
  const linkToDelete = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!linkToDelete) {
    return null;
  }

  Promise.all([
    deleteFromCache(
      constructCacheKey(linkToDelete.domain, linkToDelete.alias!)
    ),
    ctx.db
      .delete(link)
      .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId))),
  ]);
};

export const retrieveOriginalUrl = async (
  ctx: PublicTRPCContext,
  input: RetrieveOriginalUrlInput
) => {
  const { alias, domain } = input;
  const cacheKey = `${domain}:${alias}`;

  let link: Link | undefined | null = await getFromCache(cacheKey);

  if (!link?.alias) {
    link = await ctx.db.query.link.findFirst({
      where: (table, { eq, and, sql }) =>
        and(
          sql`lower(${table.alias}) = lower(${input.alias})`,
          eq(table.domain, domain)
        ),
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
  ctx: ProtectedTRPCContext,
  input: QuickLinkShorteningInput
) => {
  const { currentCount, limit } = await checkAndUpdateLinkLimit(ctx);

  const alias = await generateShortLink();
  const domain = await getUserDefaultDomain(ctx);

  const fetchedMetadata = await fetchMetadataInfo(input.url);
  const phishingResult = await detectPhishingLink(input.url, fetchedMetadata);

  if (phishingResult.phishing) {
    throw new Error(
      "This URL has been detected as a potential phishing site. Shortening will not continue."
    );
  }

  const name = fetchedMetadata.title ?? "Untitled Link";
  const tagNames = input.tags ?? [];

  // Create link without tags field
  const [result] = await ctx.db.insert(link).values({
    url: input.url,
    alias,
    domain,
    userId: ctx.auth.userId,
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
      userId: ctx.auth.userId,
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

  await incrementLinkCount(ctx, currentCount, limit);

  return {
    id: result.insertId,
    alias,
    domain,
  };
};

export const getLinkVisits = async (
  ctx: ProtectedTRPCContext,
  input: { id: string; domain: string; range: string }
) => {
  const userInfo = await ctx.db.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, ctx.auth.userId),
    with: {
      subscriptions: true,
    },
  });

  const plan = resolvePlan(userInfo?.subscriptions ?? null);
  const userHasPaidPlan = plan !== "free";

  const link = await ctx.db.query.link.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.alias, input.id), eq(table.domain, input.domain)),
  });

  if (!link) {
    return {
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
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
          eq(visit.linkId, link.id),
          gte(visit.createdAt, startDate),
          lte(visit.createdAt, now)
        ),
    }),
    ctx.db.query.uniqueLinkVisit.findMany({
      where: (visit, { eq, and, gte, lte }) =>
        and(
          eq(visit.linkId, link.id),
          gte(visit.createdAt, startDate),
          lte(visit.createdAt, now)
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

  const countryVisits = totalVisits.reduce((acc, visit) => {
    acc[visit.country!] = (acc[visit.country!] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topCountry = Object.entries(countryVisits).reduce(
    (a, b) => (a[1] > b[1] ? a : b),
    ["", 0]
  )[0];

  const referrerVisits = totalVisits.reduce((acc, visit) => {
    acc[visit.referer!] = (acc[visit.referer!] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topReferrer = Object.entries(referrerVisits).reduce(
    (a, b) => (a[1] > b[1] ? a : b),
    ["", 0]
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
  ctx: ProtectedTRPCContext,
  input: { range: string; filterType: "all" | "folder" | "domain" | "link"; filterId?: string | number }
) => {
  console.log("🔍 getAllUserAnalytics - Context:", ctx.auth.userId);
  console.log("🔍 getAllUserAnalytics - Context:", ctx.auth);
  const userInfo = await ctx.db.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, ctx.auth.userId),
    with: {
      subscriptions: true,
    },
  });

  console.log("🔍 getAllUserAnalytics - User info:", userInfo);

  const plan = resolvePlan(userInfo?.subscriptions ?? null);
  const userHasPaidPlan = plan !== "free";

  // Fetch user's links with optional filtering
  const userLinks = await ctx.db.query.link.findMany({
    where: (table, { eq, and, isNull }) => {
      const conditions = [eq(table.userId, ctx.auth.userId)];

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
          lte(visit.createdAt, now)
        ),
    }),
    ctx.db.query.uniqueLinkVisit.findMany({
      where: (visit, { inArray, and, gte, lte }) =>
        and(
          inArray(visit.linkId, linkIds),
          gte(visit.createdAt, startDate),
          lte(visit.createdAt, now)
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
    ])
  );

  totalVisits.forEach((visit) => {
    const linkInfo = linkIdToInfo.get(visit.linkId);
    if (linkInfo) {
      clicksByLink[linkInfo.shortLink] =
        (clicksByLink[linkInfo.shortLink] ?? 0) + 1;
      if (linkInfo.destination) {
        clicksByDestination[linkInfo.destination] =
          (clicksByDestination[linkInfo.destination] ?? 0) + 1;
      }
    }
  });

  // Calculate top country
  const countryVisits = totalVisits.reduce((acc, visit) => {
    if (visit.country) {
      acc[visit.country] = (acc[visit.country] ?? 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const topCountry =
    Object.entries(countryVisits).length > 0
      ? Object.entries(countryVisits).reduce((a, b) => (a[1] > b[1] ? a : b))[0]
      : "N/A";

  // Calculate referrers
  const referrerVisits = totalVisits.reduce((acc, visit) => {
    const ref = visit.referer ?? "null";
    acc[ref] = (acc[ref] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topReferrer =
    Object.entries(referrerVisits).length > 0
      ? Object.entries(referrerVisits).reduce((a, b) =>
          a[1] > b[1] ? a : b
        )[0]
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

export const togglePublicStats = async (
  ctx: ProtectedTRPCContext,
  input: GetLinkInput
) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!fetchedLink) {
    return null;
  }

  return ctx.db
    .update(link)
    .set({
      publicStats: !fetchedLink.publicStats,
    })
    .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));
};

export const toggleLinkStatus = async (
  ctx: ProtectedTRPCContext,
  input: GetLinkInput
) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!fetchedLink) {
    return null;
  }

  return ctx.db
    .update(link)
    .set({
      disabled: !fetchedLink.disabled,
    })
    .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));
};

export const resetLinkStatistics = async (
  ctx: ProtectedTRPCContext,
  input: GetLinkInput
) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!fetchedLink) {
    return null;
  }

  await ctx.db.delete(linkVisit).where(eq(linkVisit.linkId, fetchedLink.id));

  return fetchedLink;
};

export const verifyLinkPassword = async (
  ctx: PublicTRPCContext,
  input: { id: number; password: string }
) => {
  const link = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!link?.passwordHash) {
    return null;
  }

  const isPasswordCorrect = await bcrypt.compare(
    input.password,
    link.passwordHash
  );

  if (!isPasswordCorrect) {
    return null;
  }

  const deviceDetails = await retrieveDeviceAndGeolocationData(ctx.headers);
  const ipHash = crypto
    .createHash("sha256")
    .update(ctx.headers.get("x-forwarded-for") ?? "")
    .digest("hex");
  const existingLinkVisit = await ctx.db.query.uniqueLinkVisit.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.linkId, link.id), eq(table.ipHash, ipHash)),
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
  ctx: ProtectedTRPCContext,
  input: { id: number; password: string }
) => {
  const passwordHash = await bcrypt.hash(input.password, 10);

  await ctx.db
    .update(link)
    .set({
      passwordHash,
    })
    .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));

  const updatedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  await deleteFromCache(
    constructCacheKey(updatedLink!.domain, updatedLink!.alias!)
  );

  return updatedLink;
};

export const checkAliasAvailability = async (
  ctx: PublicTRPCContext,
  input: { alias: string; domain: string }
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

export const bulkCreateLinks = async (
  ctx: ProtectedTRPCContext,
  csvContent: string
) => {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as LinkRecord[];

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
        userId: ctx.auth.userId,
        domain: record.domain ?? "ishortn.ink",
        note: record.note,
      });
    })
  );

  const successfulLinks = bulkLinksCreationPromiseResults.filter(
    (result) => result.status === "fulfilled"
  ).length;
  const failedLinks = bulkLinksCreationPromiseResults.filter(
    (result) => result.status === "rejected"
  ).length;

  // TODO: add a way to notify the user about links that failed. We have already added an email template.
  // so we need to filter the links that failed and attach the right reason to the email.

  return {
    success: true,
    message: `${successfulLinks} links created successfully, ${failedLinks} links failed to create`,
  };
};

export const exportAllUserLinks = async (ctx: ProtectedTRPCContext) => {
  return ctx.db.query.link.findMany({
    columns: {
      url: true,
      alias: true,
      note: true,
      domain: true,
      createdAt: true,
    },
    where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
  });
};

export const checkPresenceOfVercelHeaders = async (ctx: PublicTRPCContext) => {
  return {
    headers: ctx.headers,
    countryHeader: ctx.headers.get("x-vercel-ip-country"),
    cityHeader: ctx.headers.get("x-vercel-ip-city"),
  };
};

export const toggleArchive = async (
  ctx: ProtectedTRPCContext,
  input: ToggleArchiveInput
) => {
  const currentLink = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)),
    columns: { archived: true },
  });

  if (!currentLink) {
    throw new Error(
      "Link not found or you don't have permission to modify it."
    );
  }

  const newArchivedStatus = !currentLink.archived;

  await ctx.db
    .update(link)
    .set({ archived: newArchivedStatus })
    .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));

  // Invalidate cache if necessary (if the link was cached)
  // Consider if archived links should be cached differently or not at all
  // For simplicity, let's remove it for now
  // await deleteFromCache(constructCacheKey(link.domain, link.alias)); // Need domain/alias

  return { success: true, archived: newArchivedStatus };
};

export const getStats = async (ctx: ProtectedTRPCContext) => {
  const [totalLinksResult, activeLinksResult] = await Promise.all([
    ctx.db
      .select({ count: count() })
      .from(link)
      .where(eq(link.userId, ctx.auth.userId)),
    ctx.db
      .select({ count: count() })
      .from(link)
      .where(and(eq(link.userId, ctx.auth.userId), eq(link.archived, false))),
  ]);

  return {
    totalLinks: totalLinksResult?.[0]?.count ?? 0,
    activeLinks: activeLinksResult?.[0]?.count ?? 0,
  };
};

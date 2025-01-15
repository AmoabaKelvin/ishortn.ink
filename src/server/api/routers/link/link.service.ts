import crypto from "node:crypto";
import { waitUntil } from "@vercel/functions";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { endOfYear, startOfMonth, startOfYear, subDays } from "date-fns";
import { and, asc, count, desc, eq, getTableColumns, sql } from "drizzle-orm";

import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { deleteFromCache, getFromCache, setInCache } from "@/lib/core/cache";
import { generateShortLink } from "@/lib/core/links";
import { fetchMetadataInfo } from "@/lib/utils/fetch-link-metadata";
import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { db } from "@/server/db";
import { link, linkVisit, uniqueLinkVisit } from "@/server/db/schema";

import {
  checkAndUpdateLinkLimit,
  getUserDefaultDomain,
  incrementLinkCount,
  logAnalytics,
  validateAlias,
} from "./utils";

import type { Link } from "@/server/db/schema";
import type { ProtectedTRPCContext, PublicTRPCContext } from "../../trpc";
import type {
  CreateLinkInput,
  GetLinkInput,
  ListLinksInput,
  QuickLinkShorteningInput,
  RetrieveOriginalUrlInput,
  UpdateLinkInput,
} from "./link.input";

function constructCacheKey(domain: string, alias: string) {
  return `${domain}:${alias}`;
}

export const getLinks = async (ctx: ProtectedTRPCContext, input: ListLinksInput) => {
  const { page, pageSize, orderBy, orderDirection } = input;

  const orderColumn =
    orderBy === "totalClicks"
      ? count(linkVisit.id)
      : orderBy === "lastClicked"
        ? sql`MAX(${linkVisit.createdAt})`
        : link.createdAt;
  const orderFunc = orderDirection === "desc" ? desc : asc;

  const [totalLinksResult, totalClicksResult, links] = await Promise.all([
    ctx.db.select({ count: count() }).from(link).where(eq(link.userId, ctx.auth.userId)),
    ctx.db
      .select({ totalClicks: count(linkVisit.id) })
      .from(linkVisit)
      .innerJoin(link, eq(link.id, linkVisit.linkId))
      .where(eq(link.userId, ctx.auth.userId)),
    ctx.db
      .select({
        ...getTableColumns(link),
        totalClicks: count(linkVisit.id).as("total_clicks"),
      })
      .from(link)
      .leftJoin(linkVisit, eq(link.id, linkVisit.linkId))
      .where(eq(link.userId, ctx.auth.userId))
      .groupBy(link.id)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .orderBy(orderFunc(orderColumn)),
  ]);

  const totalLinks = totalLinksResult?.[0]?.count ?? 0;
  const totalClicks = totalClicksResult?.[0]?.totalClicks ?? 0;

  return {
    links,
    totalLinks,
    totalClicks,
    currentPage: page,
    totalPages: Math.ceil(totalLinks / pageSize),
  };
};

export const getLink = async (ctx: ProtectedTRPCContext, input: GetLinkInput) => {
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
    .where(and(eq(link.domain, input.domain), sql`lower(${link.alias}) = lower(${input.alias})`));
};

export const createLink = async (ctx: ProtectedTRPCContext, input: CreateLinkInput) => {
  const { isProUser, currentCount } = await checkAndUpdateLinkLimit(ctx);

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
    await validateAlias(ctx, input.alias, domain);
  }

  if (input.password) {
    if (!isProUser) {
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
    if (!isProUser) {
      throw new Error("You need to upgrade to a pro plan to use custom social media previews");
    }
  }

  input.metadata = {
    title: inputMetaData?.title ?? fetchedMetadata.title,
    description: inputMetaData?.description ?? fetchedMetadata.description,
    image: inputMetaData?.image ?? fetchedMetadata.image,
  };

  const name = input.name ?? fetchedMetadata.title ?? "Untitled Link";

  const [result] = await ctx.db.insert(link).values({
    ...input,
    name,
    alias: alias,
    userId: ctx.auth.userId,
    passwordHash: input.password,
    domain,
    note: input.note,
    metadata: {
      ...input.metadata,
    },
  });

  if (!isProUser) {
    await incrementLinkCount(ctx, currentCount, isProUser);
  }

  return result;
};

export const updateLink = async (ctx: ProtectedTRPCContext, input: UpdateLinkInput) => {
  await ctx.db
    .update(link)
    .set(input)
    .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));

  const updatedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (updatedLink?.alias !== input.alias || updatedLink?.domain !== input.domain) {
    await deleteFromCache(constructCacheKey(updatedLink!.domain, updatedLink!.alias!));
  }
  await setInCache(constructCacheKey(updatedLink!.domain, updatedLink!.alias!), updatedLink!);
};

export const deleteLink = async (ctx: ProtectedTRPCContext, input: GetLinkInput) => {
  const linkToDelete = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!linkToDelete) {
    return null;
  }

  Promise.all([
    deleteFromCache(constructCacheKey(linkToDelete.domain, linkToDelete.alias!)),
    ctx.db.delete(link).where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId))),
  ]);
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
  ctx: ProtectedTRPCContext,
  input: QuickLinkShorteningInput,
) => {
  const { isProUser, currentCount } = await checkAndUpdateLinkLimit(ctx);

  const [defaultDomain, phishingResult] = await Promise.all([
    getUserDefaultDomain(ctx),
    detectPhishingLink(input.url, await fetchMetadataInfo(input.url)),
  ]);

  if (phishingResult.phishing) {
    throw new Error(
      "This URL has been detected as a potential phishing site. Shortened link will not be created.",
    );
  }

  const [insertionResult] = await ctx.db.insert(link).values({
    url: input.url,
    alias: await generateShortLink(),
    userId: ctx.auth.userId,
    domain: defaultDomain,
  });

  const insertedLinkId = insertionResult.insertId;

  const insertedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, insertedLinkId),
  });

  if (insertedLink) {
    if (!isProUser) {
      await incrementLinkCount(ctx, currentCount, isProUser);
    }
    await setInCache(constructCacheKey(insertedLink.domain, insertedLink.alias!), insertedLink);
  }

  return insertedLink;
};

export const getLinkVisits = async (
  ctx: ProtectedTRPCContext,
  input: { id: string; domain: string; range: string },
) => {
  const userSubscription = await ctx.db.query.subscription.findFirst({
    where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
  });
  const userHasProPlan = userSubscription?.status === "active";

  const link = await ctx.db.query.link.findFirst({
    where: (table, { eq, and }) => and(eq(table.alias, input.id), eq(table.domain, input.domain)),
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
  if (!userHasProPlan && !["24h", "7d"].includes(range)) {
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
        and(eq(visit.linkId, link.id), gte(visit.createdAt, startDate), lte(visit.createdAt, now)),
    }),
    ctx.db.query.uniqueLinkVisit.findMany({
      where: (visit, { eq, and, gte, lte }) =>
        and(eq(visit.linkId, link.id), gte(visit.createdAt, startDate), lte(visit.createdAt, now)),
    }),
  ]);

  if (totalVisits.length === 0) {
    return {
      totalVisits: [],
      uniqueVisits: [],
      topCountry: "N/A",
      referers: {},
      topReferrer: "N/A",
      isProPlan: userHasProPlan,
    };
  }

  const countryVisits = totalVisits.reduce(
    (acc, visit) => {
      acc[visit.country!] = (acc[visit.country!] ?? 0) + 1;
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
      acc[visit.referer!] = (acc[visit.referer!] ?? 0) + 1;
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
    isProPlan: userHasProPlan,
  };
};

export const togglePublicStats = async (ctx: ProtectedTRPCContext, input: GetLinkInput) => {
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

export const toggleLinkStatus = async (ctx: ProtectedTRPCContext, input: GetLinkInput) => {
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

export const resetLinkStatistics = async (ctx: ProtectedTRPCContext, input: GetLinkInput) => {
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
  ctx: ProtectedTRPCContext,
  input: { id: number; password: string },
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

export const bulkCreateLinks = async (ctx: ProtectedTRPCContext, csvContent: string) => {
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

import bcrypt from "bcryptjs";
import { and, count, desc, eq } from "drizzle-orm";

import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { Cache } from "@/lib/core/cache";
import { generateShortLink } from "@/lib/core/links";
import { db } from "@/server/db";
import { link, linkVisit } from "@/server/db/schema";

import type { ProtectedTRPCContext, PublicTRPCContext } from "../../trpc";
import type {
  CreateLinkInput,
  GetLinkInput,
  QuickLinkShorteningInput,
  RetrieveOriginalUrlInput,
  UpdateLinkInput,
} from "./link.input";
const cache = new Cache();

function constructCacheKey(domain: string, alias: string) {
  return `${domain}:${alias}`;
}

export const getLinks = async (ctx: ProtectedTRPCContext) => {
  const links = await ctx.db
    .select({
      id: link.id,
      url: link.url,
      alias: link.alias,
      domain: link.domain,
      createdAt: link.createdAt,
      disableLinkAfterClicks: link.disableLinkAfterClicks,
      disableLinkAfterDate: link.disableLinkAfterDate,
      disabled: link.disabled,
      publicStats: link.publicStats,
      userId: link.userId,
      passwordHash: link.passwordHash,
      totalClicks: count(linkVisit.id),
    })
    .from(link)
    .leftJoin(linkVisit, eq(link.id, linkVisit.linkId))
    .where(eq(link.userId, ctx.auth.userId))
    .groupBy(link.id)
    .orderBy(desc(link.createdAt));

  return links;
};

export const getLink = async (ctx: ProtectedTRPCContext, input: GetLinkInput) => {
  return await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });
};

export const getLinkByAlias = async (input: { alias: string; domain: string }) => {
  return db
    .select()
    .from(link)
    .where(and(eq(link.domain, input.domain), eq(link.alias, input.alias)));
};

export const createLink = async (ctx: ProtectedTRPCContext, input: CreateLinkInput) => {
  if (input.alias) {
    if (input.alias.includes(".")) {
      throw new Error("Cannot include periods in alias");
    }

    const domain = input.domain ?? "ishortn.ink";

    // const aliasExists = await ctx.db
    //   .select()
    //   .from(link)
    //   .where(and(eq(link.alias, input.alias), eq(link.userId, ctx.auth.userId)));

    const aliasExists = await ctx.db
      .select()
      .from(link)
      .where(and(eq(link.alias, input.alias), eq(link.domain, domain)));

    if (aliasExists.length) {
      throw new Error("Alias already exists");
    }
  }

  if (input.password) {
    const userSubscription = await ctx.db.query.subscription.findFirst({
      where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
    });

    if (userSubscription?.status !== "active") {
      throw new Error("You need to upgrade to a pro plan to use password protection");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    input.password = passwordHash;
  }

  const domain = input.domain ?? "ishortn.ink";

  return await ctx.db.insert(link).values({
    ...input,
    alias: input.alias ?? (await generateShortLink()),
    userId: ctx.auth.userId,
    passwordHash: input.password,
    domain,
  });
};

export const updateLink = async (ctx: ProtectedTRPCContext, input: UpdateLinkInput) => {
  await ctx.db
    .update(link)
    .set(input)
    .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));

  if (input.alias) {
    await cache.delete(input.alias);
  }

  const updatedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  await cache.set(constructCacheKey(updatedLink!.domain, updatedLink!.alias!), updatedLink!);
};

export const deleteLink = async (ctx: ProtectedTRPCContext, input: GetLinkInput) => {
  const linkToDelete = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!linkToDelete) {
    return null;
  }

  await cache.delete(constructCacheKey(linkToDelete.domain, linkToDelete.alias!));

  await ctx.db.delete(link).where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));
};

export const retrieveOriginalUrl = async (
  ctx: PublicTRPCContext,
  input: RetrieveOriginalUrlInput,
) => {
  const { alias, domain } = input;
  const cacheKey = `${domain}:${alias}`;

  const cachedLink = await cache.get(input.alias);
  const deviceDetails = await retrieveDeviceAndGeolocationData(ctx.headers);

  console.log("Log is", cachedLink, typeof cachedLink?.id);

  if (cachedLink?.alias) {
    await ctx.db.insert(linkVisit).values({
      linkId: cachedLink.id,
      ...deviceDetails,
    });
    return cachedLink;
  }

  const link = await ctx.db.query.link.findFirst({
    where: (table, { eq, and }) => and(eq(table.alias, input.alias), eq(table.domain, domain)),
  });

  if (!link) {
    return null;
  }

  // only log as a visit if the link is not password protected
  if (!link.passwordHash) {
    await ctx.db.insert(linkVisit).values({
      linkId: link.id,
      ...deviceDetails,
    });
  }

  await cache.set(cacheKey, link);

  return link;
};

export const shortenLinkWithAutoAlias = async (
  ctx: ProtectedTRPCContext,
  input: QuickLinkShorteningInput,
) => {
  const insertionResult = await ctx.db.insert(link).values({
    url: input.url,
    alias: await generateShortLink(),
    userId: ctx.auth.userId,
  });

  const insertedLinkId = insertionResult[0].insertId;

  const insertedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, insertedLinkId),
  });

  if (insertedLink) {
    await cache.set(constructCacheKey(insertedLink.domain, insertedLink.alias!), insertedLink);
  }

  return insertedLink;
};

export const getLinkVisits = async (
  ctx: ProtectedTRPCContext,
  input: { id: string; domain: string },
) => {
  const link = await ctx.db.query.link.findFirst({
    where: (table, { eq, and }) => and(eq(table.alias, input.id), eq(table.domain, input.domain)),
    with: {
      linkVisits: true,
    },
  });

  return link?.linkVisits ?? [];
};

export const toggleLinkStatus = async (ctx: ProtectedTRPCContext, input: GetLinkInput) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!fetchedLink) {
    return null;
  }

  return await ctx.db
    .update(link)
    .set({
      disabled: !fetchedLink.disabled,
    })
    .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));
};

export const togglePublicStats = async (ctx: ProtectedTRPCContext, input: GetLinkInput) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.id, input.id),
  });

  if (!fetchedLink) {
    return null;
  }

  return await ctx.db
    .update(link)
    .set({
      publicStats: !fetchedLink.publicStats,
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

  await cache.delete(constructCacheKey(updatedLink!.domain, updatedLink!.alias!));

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

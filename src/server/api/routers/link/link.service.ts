import { and, count, desc, eq } from "drizzle-orm";

import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { Cache } from "@/lib/core/cache";
import { generateShortLink } from "@/lib/core/links";
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

export const getLinks = async (ctx: ProtectedTRPCContext) => {
  const links = await ctx.db
    .select({
      id: link.id,
      url: link.url,
      alias: link.alias,
      createdAt: link.createdAt,
      disableLinkAfterClicks: link.disableLinkAfterClicks,
      disableLinkAfterDate: link.disableLinkAfterDate,
      disabled: link.disabled,
      publicStats: link.publicStats,
      userId: link.userId,
      totalClicks: count(linkVisit.id),
    })
    .from(link)
    .leftJoin(linkVisit, eq(link.id, linkVisit.linkId))
    .where(eq(link.userId, ctx.auth.userId))
    .groupBy(link.id)
    .orderBy(desc(link.createdAt));

  return links;
};

export const createLink = async (ctx: ProtectedTRPCContext, input: CreateLinkInput) => {
  if (input.alias) {
    const aliasExists = await ctx.db
      .select()
      .from(link)
      .where(and(eq(link.alias, input.alias), eq(link.userId, ctx.auth.userId)));

    if (aliasExists.length) {
      throw new Error("Alias already exists");
    }
  }

  return await ctx.db.insert(link).values({
    ...input,
    alias: input.alias ?? (await generateShortLink()),
    userId: ctx.auth.userId,
  });
};

export const updateLink = async (ctx: ProtectedTRPCContext, input: UpdateLinkInput) => {
  return await ctx.db
    .update(link)
    .set(input)
    .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));
};

export const deleteLink = async (ctx: ProtectedTRPCContext, input: GetLinkInput) => {
  return await ctx.db
    .delete(link)
    .where(and(eq(link.id, input.id), eq(link.userId, ctx.auth.userId)));
};

export const retrieveOriginalUrl = async (
  ctx: PublicTRPCContext,
  input: RetrieveOriginalUrlInput,
) => {
  const cachedLink = await cache.get(input.alias);

  if (cachedLink) {
    return cachedLink;
  }

  const link = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.alias, input.alias),
  });

  if (!link) {
    return null;
  }

  const deviceDetails = await retrieveDeviceAndGeolocationData(ctx.headers);

  await ctx.db.insert(linkVisit).values({
    linkId: link.id,
    ...deviceDetails,
  });

  return link;
};

export const shortenLinkWithAutoAlias = async (
  ctx: ProtectedTRPCContext,
  input: QuickLinkShorteningInput,
) => {
  return await ctx.db.insert(link).values({
    url: input.url,
    alias: await generateShortLink(),
    userId: ctx.auth.userId,
  });
};

export const getLinkVisits = async (ctx: ProtectedTRPCContext, input: { id: string }) => {
  const link = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.alias, input.id),
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

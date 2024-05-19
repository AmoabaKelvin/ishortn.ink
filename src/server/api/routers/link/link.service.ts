import { waitUntil } from "@vercel/functions";
import { and, eq } from "drizzle-orm";

import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { link, linkVisit } from "@/server/db/schema";

import type { ProtectedTRPCContext, PublicTRPCContext } from "../../trpc";
import type {
  CreateLinkInput,
  GetLinkInput,
  RetrieveOriginalUrlInput,
  UpdateLinkInput,
} from "./link.input";
export const getLinks = async (ctx: ProtectedTRPCContext) => {
  const links = await ctx.db.query.link.findMany({
    where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
  });
  return links;
};

export const createLink = async (ctx: ProtectedTRPCContext, input: CreateLinkInput) => {
  return await ctx.db.insert(link).values({
    ...input,
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
  const link = await ctx.db.query.link.findFirst({
    where: (table, { eq }) => eq(table.alias, input.alias),
  });

  if (!link) {
    return null;
  }

  const insertAnalyticsData = async () => {
    const deviceDetails = await retrieveDeviceAndGeolocationData(ctx.headers);

    await ctx.db.insert(linkVisit).values({
      linkId: link.id,
      ...deviceDetails,
    });
  };

  waitUntil(insertAnalyticsData());

  return link;
};

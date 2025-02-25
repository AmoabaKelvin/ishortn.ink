import { and, eq } from "drizzle-orm";

import { linkTag, tag } from "@/server/db/schema";

import type { ProtectedTRPCContext } from "../../trpc";

// Create a new tag if it doesn't exist
export const createTag = async (ctx: ProtectedTRPCContext, tagName: string) => {
  // Check if tag already exists for this user
  const existingTag = await ctx.db.query.tag.findFirst({
    where: and(
      eq(tag.name, tagName.toLowerCase().trim()),
      eq(tag.userId, ctx.auth.userId)
    ),
  });

  if (existingTag) {
    return existingTag;
  }

  // Create new tag
  const [result] = await ctx.db.insert(tag).values({
    name: tagName.toLowerCase().trim(),
    userId: ctx.auth.userId,
  });

  return {
    id: result.insertId,
    name: tagName.toLowerCase().trim(),
    userId: ctx.auth.userId,
  };
};

// Get all tags for a user
export const getUserTags = async (ctx: ProtectedTRPCContext) => {
  return ctx.db.query.tag.findMany({
    where: eq(tag.userId, ctx.auth.userId),
    orderBy: (tag) => tag.name,
  });
};

// Associate tags with a link
export const associateTagsWithLink = async (
  ctx: ProtectedTRPCContext,
  linkId: number,
  tagNames: string[]
) => {
  // First, remove all existing tag associations for this link
  await ctx.db.delete(linkTag).where(eq(linkTag.linkId, linkId));

  if (!tagNames.length) return;

  // Create or get tags and create associations
  const tagPromises = tagNames.map(async (tagName) => {
    const tagRecord = await createTag(ctx, tagName);
    return tagRecord;
  });

  const tags = await Promise.all(tagPromises);

  // Create link-tag associations
  const linkTagValues = tags.map((tag) => ({
    linkId,
    tagId: Number(tag.id),
  }));

  await ctx.db.insert(linkTag).values(linkTagValues);
};

// Get tags for a specific link
export const getTagsForLink = async (
  ctx: ProtectedTRPCContext,
  linkId: number
) => {
  const result = await ctx.db
    .select({
      id: tag.id,
      name: tag.name,
    })
    .from(linkTag)
    .innerJoin(tag, eq(linkTag.tagId, tag.id))
    .where(eq(linkTag.linkId, linkId));

  return result;
};

// Get links by tag
export const getLinksByTag = async (
  ctx: ProtectedTRPCContext,
  tagName: string
) => {
  const tagRecord = await ctx.db.query.tag.findFirst({
    where: and(
      eq(tag.name, tagName.toLowerCase().trim()),
      eq(tag.userId, ctx.auth.userId)
    ),
  });

  if (!tagRecord) {
    return [];
  }

  const result = await ctx.db
    .select({
      linkId: linkTag.linkId,
    })
    .from(linkTag)
    .where(eq(linkTag.tagId, tagRecord.id));

  return result.map((r) => r.linkId);
};

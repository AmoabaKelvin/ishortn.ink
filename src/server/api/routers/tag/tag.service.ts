import { and, eq } from "drizzle-orm";

import { linkTag, tag } from "@/server/db/schema";
import {
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import type { ProtectedTRPCContext, WorkspaceTRPCContext } from "../../trpc";

// Create a new tag if it doesn't exist
export const createTag = async (ctx: WorkspaceTRPCContext, tagName: string) => {
  // Check if tag already exists for this workspace
  const existingTag = await ctx.db.query.tag.findFirst({
    where: and(
      eq(tag.name, tagName.toLowerCase().trim()),
      workspaceFilter(ctx.workspace, tag.userId, tag.teamId)
    ),
  });

  if (existingTag) {
    return existingTag;
  }

  const ownership = workspaceOwnership(ctx.workspace);

  // Create new tag
  const [result] = await ctx.db.insert(tag).values({
    name: tagName.toLowerCase().trim(),
    userId: ownership.userId,
    teamId: ownership.teamId,
  });

  return {
    id: result.insertId,
    name: tagName.toLowerCase().trim(),
    userId: ownership.userId,
    teamId: ownership.teamId,
  };
};

// Get all tags for a workspace
export const getUserTags = async (ctx: WorkspaceTRPCContext) => {
  return ctx.db.query.tag.findMany({
    where: workspaceFilter(ctx.workspace, tag.userId, tag.teamId),
    orderBy: (tag) => tag.name,
  });
};

// Associate tags with a link
export const associateTagsWithLink = async (
  ctx: WorkspaceTRPCContext,
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
  ctx: WorkspaceTRPCContext,
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
  ctx: WorkspaceTRPCContext,
  tagName: string
) => {
  const tagRecord = await ctx.db.query.tag.findFirst({
    where: and(
      eq(tag.name, tagName.toLowerCase().trim()),
      workspaceFilter(ctx.workspace, tag.userId, tag.teamId)
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

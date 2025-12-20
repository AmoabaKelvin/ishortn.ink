import { and, eq, isNull } from "drizzle-orm";

import { link, linkTag, tag } from "@/server/db/schema";
import {
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import type { ProtectedTRPCContext, WorkspaceTRPCContext } from "../../trpc";

// Create a new tag if it doesn't exist
// Uses transaction to prevent race conditions for personal workspace tags
// (MySQL unique constraint on (name, teamId) doesn't prevent duplicates when teamId is NULL)
export const createTag = async (ctx: WorkspaceTRPCContext, tagName: string) => {
  const normalizedName = tagName.toLowerCase().trim();
  const ownership = workspaceOwnership(ctx.workspace);

  // For team workspaces, the DB unique constraint handles uniqueness
  // For personal workspaces, we need atomic check-and-insert
  if (ctx.workspace.type === "team") {
    // Check if tag already exists for this team
    const existingTag = await ctx.db.query.tag.findFirst({
      where: and(
        eq(tag.name, normalizedName),
        eq(tag.teamId, ctx.workspace.teamId)
      ),
    });

    if (existingTag) {
      return existingTag;
    }

    // Create new tag - DB unique constraint prevents duplicates
    const [result] = await ctx.db.insert(tag).values({
      name: normalizedName,
      userId: ownership.userId,
      teamId: ownership.teamId,
    });

    return {
      id: result.insertId,
      name: normalizedName,
      userId: ownership.userId,
      teamId: ownership.teamId,
    };
  }

  // Personal workspace: use transaction for atomic check-and-insert
  // This prevents race conditions since MySQL allows multiple NULL values in unique constraint
  return ctx.db.transaction(async (tx) => {
    // Check if tag already exists for this user's personal workspace
    const existingTag = await tx.query.tag.findFirst({
      where: and(
        eq(tag.name, normalizedName),
        eq(tag.userId, ctx.auth.userId),
        isNull(tag.teamId) // Personal workspace has null teamId
      ),
    });

    if (existingTag) {
      return existingTag;
    }

    // Create new tag within transaction
    const [result] = await tx.insert(tag).values({
      name: normalizedName,
      userId: ownership.userId,
      teamId: null,
    });

    return {
      id: result.insertId,
      name: normalizedName,
      userId: ownership.userId,
      teamId: null,
    };
  });
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
  // Verify the link belongs to the current workspace before modifying
  const linkRecord = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, linkId),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (!linkRecord) {
    // Link doesn't exist or doesn't belong to this workspace
    return;
  }

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
// Verifies the link belongs to the current workspace before returning tags
export const getTagsForLink = async (
  ctx: WorkspaceTRPCContext,
  linkId: number
) => {
  // Verify the link belongs to the current workspace
  const linkRecord = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, linkId),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (!linkRecord) {
    // Link doesn't exist or doesn't belong to this workspace
    return [];
  }

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

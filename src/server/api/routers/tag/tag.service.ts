import { and, eq, inArray, isNull } from "drizzle-orm";

import { link, linkTag, tag } from "@/server/db/schema";
import { workspaceFilter, workspaceOwnership } from "@/server/lib/workspace";

import { normalizeTagName, normalizeTagNames } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { DbClient } from "@/server/lib/user-plan";

/** A workspace context whose db may be a transaction, so tag writes can join the caller's. */
type TagWriteContext = Pick<WorkspaceTRPCContext, "auth" | "workspace"> & { db: DbClient };

// Create a new tag if it doesn't exist
// Uses transaction to prevent race conditions for personal workspace tags
// (MySQL unique constraint on (name, teamId) doesn't prevent duplicates when teamId is NULL)
export const createTag = async (ctx: TagWriteContext, tagName: string) => {
  const normalizedName = normalizeTagName(tagName);
  const ownership = workspaceOwnership(ctx.workspace);

  // For team workspaces, the DB unique constraint handles uniqueness
  // For personal workspaces, we need atomic check-and-insert
  if (ctx.workspace.type === "team") {
    // Check if tag already exists for this team
    const existingTag = await ctx.db.query.tag.findFirst({
      where: and(eq(tag.name, normalizedName), eq(tag.teamId, ctx.workspace.teamId)),
    });

    if (existingTag) {
      return existingTag;
    }

    // Create new tag - DB unique constraint prevents duplicates
    // Handle race condition: if another request creates the tag between our check and insert,
    // catch the duplicate key error and return the existing tag
    try {
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
    } catch (error) {
      // Check if this is a duplicate key error (MySQL error code 1062).
      // drizzle-orm >= 0.44 wraps driver errors in DrizzleQueryError, so the
      // original mysql2 error lives at error.cause.
      const isDuplicateKey = (candidate: Error) =>
        candidate.message.includes("Duplicate entry") ||
        candidate.message.includes("ER_DUP_ENTRY") ||
        ("code" in candidate && candidate.code === "ER_DUP_ENTRY");
      const isDuplicateKeyError =
        error instanceof Error &&
        (isDuplicateKey(error) || (error.cause instanceof Error && isDuplicateKey(error.cause)));

      if (isDuplicateKeyError) {
        // Another request created the tag concurrently, fetch and return it
        const createdTag = await ctx.db.query.tag.findFirst({
          where: and(eq(tag.name, normalizedName), eq(tag.teamId, ctx.workspace.teamId)),
        });

        if (createdTag) {
          return createdTag;
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  // Personal workspace: use transaction for atomic check-and-insert
  // This prevents race conditions since MySQL allows multiple NULL values in unique constraint
  return ctx.db.transaction(async (tx) => {
    // Check if tag already exists for this user's personal workspace
    const existingTag = await tx.query.tag.findFirst({
      where: and(
        eq(tag.name, normalizedName),
        eq(tag.userId, ctx.auth.userId),
        isNull(tag.teamId), // Personal workspace has null teamId
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

// Replace a link's tags. Callers run this in a transaction with the link write
// (pass the transaction as ctx.db), so a failure leaves the previous tags intact.
export const associateTagsWithLink = async (
  ctx: TagWriteContext,
  linkId: number,
  tagNames: string[],
) => {
  // Verify the link belongs to the current workspace before modifying
  const linkRecord = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, linkId), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (!linkRecord) {
    // Link doesn't exist or doesn't belong to this workspace
    return;
  }

  // "Marketing" and "marketing" are one tag; two copies would collide on the
  // LinkTag primary key.
  const names = normalizeTagNames(tagNames);

  const existingTags = names.length
    ? await ctx.db.query.tag.findMany({
        where: and(
          inArray(tag.name, names),
          workspaceFilter(ctx.workspace, tag.userId, tag.teamId),
        ),
      })
    : [];
  const tagIdByName = new Map(existingTags.map((t) => [normalizeTagName(t.name), t.id]));

  // Sequential: a transaction runs on one connection anyway.
  for (const name of names) {
    if (tagIdByName.has(name)) continue;
    const created = await createTag(ctx, name);
    tagIdByName.set(name, Number(created.id));
  }

  await ctx.db.delete(linkTag).where(eq(linkTag.linkId, linkId));

  const tagIds = [...new Set(names.map((name) => tagIdByName.get(name)!))];
  if (!tagIds.length) return;

  await ctx.db.insert(linkTag).values(tagIds.map((tagId) => ({ linkId, tagId: Number(tagId) })));
};

// Get tags for a specific link
// Verifies the link belongs to the current workspace before returning tags
export const getTagsForLink = async (ctx: WorkspaceTRPCContext, linkId: number) => {
  // Verify the link belongs to the current workspace
  const linkRecord = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, linkId), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
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
export const getLinksByTag = async (ctx: WorkspaceTRPCContext, tagName: string) => {
  const tagRecord = await ctx.db.query.tag.findFirst({
    where: and(
      eq(tag.name, normalizeTagName(tagName)),
      workspaceFilter(ctx.workspace, tag.userId, tag.teamId),
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

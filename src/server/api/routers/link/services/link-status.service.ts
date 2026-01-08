/**
 * Link Status operations
 * Handles toggling link states (public stats, disabled, archived)
 */

import { and, eq } from "drizzle-orm";

import { link } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";

import type { db } from "@/server/db";
import type { WorkspaceTRPCContext } from "../../../trpc";
import type { GetLinkInput, ToggleArchiveInput } from "../link.input";

export const togglePublicStats = async (
  ctx: WorkspaceTRPCContext,
  input: GetLinkInput
) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, input.id),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (!fetchedLink) {
    return null;
  }

  return ctx.db
    .update(link)
    .set({
      publicStats: !fetchedLink.publicStats,
    })
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));
};

export const toggleLinkStatus = async (
  ctx: WorkspaceTRPCContext,
  input: GetLinkInput
) => {
  const fetchedLink = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, input.id),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (!fetchedLink) {
    return null;
  }

  return ctx.db
    .update(link)
    .set({
      disabled: !fetchedLink.disabled,
    })
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));
};

export const toggleArchive = async (
  ctx: WorkspaceTRPCContext,
  input: ToggleArchiveInput
) => {
  const currentLink = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
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
    .where(and(eq(link.id, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

  // Invalidate cache if necessary (if the link was cached)
  // Consider if archived links should be cached differently or not at all
  // For simplicity, let's remove it for now
  // await deleteFromCache(constructCacheKey(link.domain, link.alias)); // Need domain/alias

  return { success: true, archived: newArchivedStatus };
};

export const checkAliasAvailability = async (
  ctx: { db: typeof db },
  input: { alias: string; domain: string }
) => {
  const existingLink = await ctx.db.query.link.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.alias, input.alias), eq(table.domain, input.domain)),
  });

  return { isAvailable: !existingLink };
};

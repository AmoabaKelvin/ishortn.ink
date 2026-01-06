/**
 * Link Bulk operations
 * Handles batch operations on multiple links
 */

import { parse } from "csv-parse/sync";
import { and, inArray } from "drizzle-orm";

import { deleteFromCache } from "@/lib/core/cache";
import { generateShortLink } from "@/lib/core/links";
import {
  link,
  linkTag,
  linkVisit,
  qrcode,
  uniqueLinkVisit,
} from "@/server/db/schema";
import {
  getAccessibleFolderIds,
  isWorkspaceAdmin,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import { constructCacheKey } from "./link-shared";

import type { WorkspaceTRPCContext } from "../../../trpc";
import type { BulkArchiveLinksInput, BulkToggleLinkStatusInput } from "../link.input";

export const bulkDeleteLinks = async (
  ctx: WorkspaceTRPCContext,
  linkIds: number[]
) => {
  if (linkIds.length === 0) {
    return { success: true, count: 0 };
  }

  // Fetch links to delete (for cache invalidation)
  let linksToDelete = await ctx.db.query.link.findMany({
    where: and(
      inArray(link.id, linkIds),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (linksToDelete.length === 0) {
    return { success: true, count: 0 };
  }

  // Filter by folder access for team members
  if (ctx.workspace.type === "team" && !isWorkspaceAdmin(ctx.workspace)) {
    const folderIds = [...new Set(linksToDelete.map((l) => l.folderId).filter((id): id is number => id !== null))];
    const accessibleFolderIds = folderIds.length > 0
      ? await getAccessibleFolderIds(ctx.db, ctx.workspace, folderIds)
      : [];
    linksToDelete = linksToDelete.filter((l) =>
      l.folderId === null || accessibleFolderIds.includes(l.folderId)
    );
  }

  if (linksToDelete.length === 0) {
    return { success: true, count: 0 };
  }

  const validLinkIds = linksToDelete.map((l) => l.id);

  // Delete from database in transaction (delete dependents first)
  await ctx.db.transaction(async (tx) => {
    // 1. Delete link visits
    await tx.delete(linkVisit).where(inArray(linkVisit.linkId, validLinkIds));

    // 2. Delete unique link visits
    await tx.delete(uniqueLinkVisit).where(inArray(uniqueLinkVisit.linkId, validLinkIds));

    // 3. Delete link-tag associations
    await tx.delete(linkTag).where(inArray(linkTag.linkId, validLinkIds));

    // 4. Delete QR codes associated with links
    await tx.delete(qrcode).where(inArray(qrcode.linkId, validLinkIds));

    // 5. Finally delete the links themselves
    await tx.delete(link).where(inArray(link.id, validLinkIds));
  });

  // Invalidate cache for all deleted links (async, don't block)
  void Promise.all(
    linksToDelete.map((l) =>
      deleteFromCache(constructCacheKey(l.domain, l.alias!))
    )
  ).catch((err) => {
    console.error("Failed to invalidate cache for deleted links:", err);
  });

  return { success: true, count: linksToDelete.length };
};

export const bulkArchiveLinks = async (
  ctx: WorkspaceTRPCContext,
  input: BulkArchiveLinksInput
) => {
  const { linkIds, archive } = input;

  if (linkIds.length === 0) {
    return { success: true, count: 0 };
  }

  // Verify links belong to workspace
  let linksToUpdate = await ctx.db.query.link.findMany({
    where: and(
      inArray(link.id, linkIds),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (linksToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  // Filter by folder access for team members
  if (ctx.workspace.type === "team" && !isWorkspaceAdmin(ctx.workspace)) {
    const folderIds = [...new Set(linksToUpdate.map((l) => l.folderId).filter((id): id is number => id !== null))];
    const accessibleFolderIds = folderIds.length > 0
      ? await getAccessibleFolderIds(ctx.db, ctx.workspace, folderIds)
      : [];
    linksToUpdate = linksToUpdate.filter((l) =>
      l.folderId === null || accessibleFolderIds.includes(l.folderId)
    );
  }

  if (linksToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  const validLinkIds = linksToUpdate.map((l) => l.id);

  await ctx.db
    .update(link)
    .set({ archived: archive })
    .where(inArray(link.id, validLinkIds));

  return { success: true, count: linksToUpdate.length, archived: archive };
};

export const bulkToggleLinkStatus = async (
  ctx: WorkspaceTRPCContext,
  input: BulkToggleLinkStatusInput
) => {
  const { linkIds, disable } = input;

  if (linkIds.length === 0) {
    return { success: true, count: 0 };
  }

  // Verify links belong to workspace
  let linksToUpdate = await ctx.db.query.link.findMany({
    where: and(
      inArray(link.id, linkIds),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (linksToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  // Filter by folder access for team members
  if (ctx.workspace.type === "team" && !isWorkspaceAdmin(ctx.workspace)) {
    const folderIds = [...new Set(linksToUpdate.map((l) => l.folderId).filter((id): id is number => id !== null))];
    const accessibleFolderIds = folderIds.length > 0
      ? await getAccessibleFolderIds(ctx.db, ctx.workspace, folderIds)
      : [];
    linksToUpdate = linksToUpdate.filter((l) =>
      l.folderId === null || accessibleFolderIds.includes(l.folderId)
    );
  }

  if (linksToUpdate.length === 0) {
    return { success: true, count: 0 };
  }

  const validLinkIds = linksToUpdate.map((l) => l.id);

  await ctx.db
    .update(link)
    .set({ disabled: disable })
    .where(inArray(link.id, validLinkIds));

  return { success: true, count: linksToUpdate.length, disabled: disable };
};

type LinkRecord = {
  url: string;
  alias?: string;
  domain?: string;
  note?: string;
};

export const bulkCreateLinks = async (
  ctx: WorkspaceTRPCContext,
  csvContent: string
) => {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as LinkRecord[];

  const ownership = workspaceOwnership(ctx.workspace);

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
        userId: ownership.userId,
        teamId: ownership.teamId,
        createdByUserId: ctx.auth.userId, // Track the actual user who created the link
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

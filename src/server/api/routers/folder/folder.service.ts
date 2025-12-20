import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { getPlanCaps } from "@/lib/billing/plans";
import { folder, link, linkVisit } from "@/server/db/schema";
import {
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";
import { getTagsForLink } from "../tag/tag.service";

import type { WorkspaceTRPCContext } from "../../trpc";
import type {
  CreateFolderInput,
  DeleteFolderInput,
  GetFolderInput,
  MoveBulkLinksToFolderInput,
  MoveLinkToFolderInput,
  UpdateFolderInput,
} from "./folder.input";

export const createFolder = async (
  ctx: WorkspaceTRPCContext,
  input: CreateFolderInput
) => {
  // Use workspace plan - team workspaces have Ultra features (unlimited folders)
  const workspacePlan = ctx.workspace.plan;
  const caps = getPlanCaps(workspacePlan);
  const folderLimit = caps.folderLimit;

  if (folderLimit === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Folders are available on Pro and Ultra plans. Upgrade to create folders.",
    });
  }

  // Team workspaces (Ultra) have no folder limit (undefined)
  if (folderLimit !== undefined) {
    const currentFolders = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(folder)
      .where(workspaceFilter(ctx.workspace, folder.userId, folder.teamId));

    if (Number(currentFolders[0]?.count ?? 0) >= folderLimit) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "You have reached your folder limit. Upgrade to Ultra for unlimited folders.",
      });
    }
  }

  // Check for duplicate folder name in workspace
  const existingFolder = await ctx.db.query.folder.findFirst({
    where: and(
      eq(folder.name, input.name),
      workspaceFilter(ctx.workspace, folder.userId, folder.teamId)
    ),
  });

  if (existingFolder) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A folder with this name already exists",
    });
  }

  const ownership = workspaceOwnership(ctx.workspace);

  await ctx.db.insert(folder).values({
    name: input.name,
    description: input.description,
    userId: ownership.userId,
    teamId: ownership.teamId,
  });

  // Query the just-created folder to get its ID
  const createdFolder = await ctx.db.query.folder.findFirst({
    where: and(
      eq(folder.name, input.name),
      workspaceFilter(ctx.workspace, folder.userId, folder.teamId)
    ),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (!createdFolder) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create folder",
    });
  }

  return {
    id: createdFolder.id,
    name: input.name,
    description: input.description,
  };
};

export const listFolders = async (ctx: WorkspaceTRPCContext) => {
  const userFolders = await ctx.db.query.folder.findMany({
    where: workspaceFilter(ctx.workspace, folder.userId, folder.teamId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  // Get link counts for each folder
  const foldersWithCounts = await Promise.all(
    userFolders.map(async (folderItem) => {
      const linkCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(link)
        .where(
          and(workspaceFilter(ctx.workspace, link.userId, link.teamId), eq(link.folderId, folderItem.id))
        );

      return {
        ...folderItem,
        linkCount: Number(linkCount[0]?.count ?? 0),
      };
    })
  );

  return foldersWithCounts;
};

export const getFolder = async (
  ctx: WorkspaceTRPCContext,
  input: GetFolderInput
) => {
  const folderData = await ctx.db.query.folder.findFirst({
    where: and(
      eq(folder.id, input.id),
      workspaceFilter(ctx.workspace, folder.userId, folder.teamId)
    ),
  });

  if (!folderData) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Folder not found",
    });
  }

  // Get all links in this folder with totalClicks
  const folderLinks = await ctx.db
    .select({
      ...getTableColumns(link),
      totalClicks: count(linkVisit.id).as("total_clicks"),
    })
    .from(link)
    .leftJoin(linkVisit, eq(link.id, linkVisit.linkId))
    .where(
      and(eq(link.folderId, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId))
    )
    .groupBy(link.id)
    .orderBy(desc(link.createdAt));

  // Fetch tags for each link
  const linksWithTags = await Promise.all(
    folderLinks.map(async (linkItem) => {
      const tagRecords = await getTagsForLink(ctx, linkItem.id);
      return {
        ...linkItem,
        tags: tagRecords.map((tagRecord) => tagRecord.name),
        folder: { id: folderData.id, name: folderData.name },
      };
    })
  );

  return {
    ...folderData,
    links: linksWithTags,
  };
};

export const updateFolder = async (
  ctx: WorkspaceTRPCContext,
  input: UpdateFolderInput
) => {
  // Check if folder exists and belongs to workspace
  const existingFolder = await ctx.db.query.folder.findFirst({
    where: and(
      eq(folder.id, input.id),
      workspaceFilter(ctx.workspace, folder.userId, folder.teamId)
    ),
  });

  if (!existingFolder) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Folder not found",
    });
  }

  // Check for duplicate name (excluding current folder)
  const duplicateFolder = await ctx.db.query.folder.findFirst({
    where: (table, { eq, and, ne }) =>
      and(
        eq(table.name, input.name),
        workspaceFilter(ctx.workspace, table.userId, table.teamId),
        ne(table.id, input.id)
      ),
  });

  if (duplicateFolder) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A folder with this name already exists",
    });
  }

  await ctx.db
    .update(folder)
    .set({
      name: input.name,
      description: input.description,
    })
    .where(and(eq(folder.id, input.id), workspaceFilter(ctx.workspace, folder.userId, folder.teamId)));

  return {
    id: input.id,
    name: input.name,
    description: input.description,
  };
};

export const deleteFolder = async (
  ctx: WorkspaceTRPCContext,
  input: DeleteFolderInput
) => {
  // Check if folder exists and belongs to workspace
  const existingFolder = await ctx.db.query.folder.findFirst({
    where: and(
      eq(folder.id, input.id),
      workspaceFilter(ctx.workspace, folder.userId, folder.teamId)
    ),
  });

  if (!existingFolder) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Folder not found",
    });
  }

  // Move all links in this folder to unfoldered (folderId = null)
  await ctx.db
    .update(link)
    .set({ folderId: null })
    .where(and(eq(link.folderId, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

  // Delete the folder
  await ctx.db.delete(folder).where(eq(folder.id, input.id));

  return { success: true };
};

export const moveLinkToFolder = async (
  ctx: WorkspaceTRPCContext,
  input: MoveLinkToFolderInput
) => {
  // Check if link exists and belongs to workspace
  const existingLink = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, input.linkId),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (!existingLink) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Link not found",
    });
  }

  // If folderId is provided, check if folder exists and belongs to workspace
  if (input.folderId !== null) {
    const folderId = input.folderId;
    const existingFolder = await ctx.db.query.folder.findFirst({
      where: and(
        eq(folder.id, folderId),
        workspaceFilter(ctx.workspace, folder.userId, folder.teamId)
      ),
    });

    if (!existingFolder) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Folder not found",
      });
    }
  }

  // Update link's folderId
  await ctx.db
    .update(link)
    .set({ folderId: input.folderId })
    .where(eq(link.id, input.linkId));

  return { success: true };
};

export const moveBulkLinksToFolder = async (
  ctx: WorkspaceTRPCContext,
  input: MoveBulkLinksToFolderInput
) => {
  if (input.linkIds.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No links selected",
    });
  }

  // If folderId is provided, check if folder exists and belongs to workspace
  if (input.folderId !== null) {
    const folderId = input.folderId;
    const existingFolder = await ctx.db.query.folder.findFirst({
      where: and(
        eq(folder.id, folderId),
        workspaceFilter(ctx.workspace, folder.userId, folder.teamId)
      ),
    });

    if (!existingFolder) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Folder not found",
      });
    }
  }

  // Update all links in the array
  await ctx.db
    .update(link)
    .set({ folderId: input.folderId })
    .where(
      and(inArray(link.id, input.linkIds), workspaceFilter(ctx.workspace, link.userId, link.teamId))
    );

  return {
    success: true,
    count: input.linkIds.length,
  };
};

export const getFolderStats = async (ctx: WorkspaceTRPCContext) => {
  const folderCount = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(folder)
    .where(workspaceFilter(ctx.workspace, folder.userId, folder.teamId));

  return {
    totalFolders: Number(folderCount[0]?.count ?? 0),
  };
};

import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { folder, link, linkVisit } from "@/server/db/schema";
import { getUserPlanContext } from "@/server/lib/user-plan";
import { getTagsForLink } from "../tag/tag.service";

import type { ProtectedTRPCContext } from "../../trpc";
import type {
  CreateFolderInput,
  DeleteFolderInput,
  GetFolderInput,
  MoveBulkLinksToFolderInput,
  MoveLinkToFolderInput,
  UpdateFolderInput,
} from "./folder.input";

export const createFolder = async (
  ctx: ProtectedTRPCContext,
  input: CreateFolderInput
) => {
  const planCtx = await getUserPlanContext(ctx.auth.userId, ctx.db);

  if (!planCtx) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  const folderLimit = planCtx.caps.folderLimit;

  if (folderLimit === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Folders are available on Pro and Ultra plans. Upgrade to create folders.",
    });
  }

  if (folderLimit !== undefined) {
    const currentFolders = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(folder)
      .where(eq(folder.userId, ctx.auth.userId));

    if (Number(currentFolders[0]?.count ?? 0) >= folderLimit) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "You have reached your folder limit. Upgrade to Ultra for unlimited folders.",
      });
    }
  }

  // Check for duplicate folder name
  const existingFolder = await ctx.db.query.folder.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.name, input.name), eq(table.userId, ctx.auth.userId)),
  });

  if (existingFolder) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A folder with this name already exists",
    });
  }

  await ctx.db.insert(folder).values({
    name: input.name,
    description: input.description,
    userId: ctx.auth.userId,
  });

  // Query the just-created folder to get its ID
  const createdFolder = await ctx.db.query.folder.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.name, input.name), eq(table.userId, ctx.auth.userId)),
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

export const listFolders = async (ctx: ProtectedTRPCContext) => {
  const userFolders = await ctx.db.query.folder.findMany({
    where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  // Get link counts for each folder
  const foldersWithCounts = await Promise.all(
    userFolders.map(async (folder) => {
      const linkCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(link)
        .where(
          and(eq(link.userId, ctx.auth.userId), eq(link.folderId, folder.id))
        );

      return {
        ...folder,
        linkCount: Number(linkCount[0]?.count ?? 0),
      };
    })
  );

  return foldersWithCounts;
};

export const getFolder = async (
  ctx: ProtectedTRPCContext,
  input: GetFolderInput
) => {
  const folderData = await ctx.db.query.folder.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.id, input.id), eq(table.userId, ctx.auth.userId)),
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
      and(eq(link.folderId, input.id), eq(link.userId, ctx.auth.userId))
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
  ctx: ProtectedTRPCContext,
  input: UpdateFolderInput
) => {
  // Check if folder exists and belongs to user
  const existingFolder = await ctx.db.query.folder.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.id, input.id), eq(table.userId, ctx.auth.userId)),
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
        eq(table.userId, ctx.auth.userId),
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
    .where(eq(folder.id, input.id));

  return {
    id: input.id,
    name: input.name,
    description: input.description,
  };
};

export const deleteFolder = async (
  ctx: ProtectedTRPCContext,
  input: DeleteFolderInput
) => {
  // Check if folder exists and belongs to user
  const existingFolder = await ctx.db.query.folder.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.id, input.id), eq(table.userId, ctx.auth.userId)),
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
    .where(and(eq(link.folderId, input.id), eq(link.userId, ctx.auth.userId)));

  // Delete the folder
  await ctx.db.delete(folder).where(eq(folder.id, input.id));

  return { success: true };
};

export const moveLinkToFolder = async (
  ctx: ProtectedTRPCContext,
  input: MoveLinkToFolderInput
) => {
  // Check if link exists and belongs to user
  const existingLink = await ctx.db.query.link.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.id, input.linkId), eq(table.userId, ctx.auth.userId)),
  });

  if (!existingLink) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Link not found",
    });
  }

  // If folderId is provided, check if folder exists and belongs to user
  if (input.folderId !== null) {
    const folderId = input.folderId;
    const existingFolder = await ctx.db.query.folder.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, folderId), eq(table.userId, ctx.auth.userId)),
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
  ctx: ProtectedTRPCContext,
  input: MoveBulkLinksToFolderInput
) => {
  if (input.linkIds.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No links selected",
    });
  }

  // If folderId is provided, check if folder exists and belongs to user
  if (input.folderId !== null) {
    const folderId = input.folderId;
    const existingFolder = await ctx.db.query.folder.findFirst({
      where: (table, { eq, and }) =>
        and(eq(table.id, folderId), eq(table.userId, ctx.auth.userId)),
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
      and(inArray(link.id, input.linkIds), eq(link.userId, ctx.auth.userId))
    );

  return {
    success: true,
    count: input.linkIds.length,
  };
};

export const getFolderStats = async (ctx: ProtectedTRPCContext) => {
  const folderCount = await ctx.db
    .select({ count: sql<number>`count(*)` })
    .from(folder)
    .where(eq(folder.userId, ctx.auth.userId));

  return {
    totalFolders: Number(folderCount[0]?.count ?? 0),
  };
};

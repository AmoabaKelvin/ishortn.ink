import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { getPlanCaps } from "@/lib/billing/plans";
import { folder, folderPermission, link, linkVisit, teamMember } from "@/server/db/schema";
import {
  getAccessibleFolderIds,
  getFolderPermissionMap,
  isWorkspaceAdmin,
  requireFolderAccess,
  requireFolderPermissionManagement,
  shouldBypassFolderPermissions,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";
import { getTagsForLink } from "../tag/tag.service";

import type { WorkspaceTRPCContext } from "../../trpc";
import type {
  CreateFolderInput,
  DeleteFolderInput,
  GetFolderInput,
  GetFolderPermissionsInput,
  MoveBulkLinksToFolderInput,
  MoveLinkToFolderInput,
  UpdateFolderInput,
  UpdateFolderPermissionsInput,
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

  const ownership = workspaceOwnership(ctx.workspace);

  // Use transaction to atomically check limits, duplicates, and insert
  return await ctx.db.transaction(async (tx) => {
    // Team workspaces (Ultra) have no folder limit (undefined)
    if (folderLimit !== undefined) {
      const currentFolders = await tx
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
    const existingFolder = await tx.query.folder.findFirst({
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

    const [inserted] = await tx.insert(folder).values({
      name: input.name,
      description: input.description,
      userId: ownership.userId,
      teamId: ownership.teamId,
    }).$returningId();

    if (!inserted) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create folder",
      });
    }

    return {
      id: inserted.id,
      name: input.name,
      description: input.description,
    };
  });
};

export const listFolders = async (ctx: WorkspaceTRPCContext) => {
  // Get all folders in workspace
  const allFolders = await ctx.db.query.folder.findMany({
    where: workspaceFilter(ctx.workspace, folder.userId, folder.teamId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  // Filter folders based on access permissions (for team members)
  let accessibleFolders = allFolders;
  if (ctx.workspace.type === "team" && !shouldBypassFolderPermissions(ctx.workspace)) {
    const folderIds = allFolders.map((f) => f.id);
    const accessibleIds = await getAccessibleFolderIds(ctx.db, ctx.workspace, folderIds);
    accessibleFolders = allFolders.filter((f) => accessibleIds.includes(f.id));
  }

  // Get permission info for displaying in UI (only for admins/owners in team workspaces)
  let permissionMap = new Map<number, string[]>();
  if (ctx.workspace.type === "team" && isWorkspaceAdmin(ctx.workspace)) {
    const folderIds = accessibleFolders.map((f) => f.id);
    permissionMap = await getFolderPermissionMap(ctx.db, folderIds);
  }

  // Get link counts for each folder
  const foldersWithCounts = await Promise.all(
    accessibleFolders.map(async (folderItem) => {
      const linkCount = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(link)
        .where(
          and(workspaceFilter(ctx.workspace, link.userId, link.teamId), eq(link.folderId, folderItem.id))
        );

      const permittedUserIds = permissionMap.get(folderItem.id) ?? [];

      return {
        ...folderItem,
        linkCount: Number(linkCount[0]?.count ?? 0),
        // Permission info for UI (only populated for admins/owners)
        hasRestrictions: permittedUserIds.length > 0,
        permittedUserIds,
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

  // Check access permission for team members
  await requireFolderAccess(ctx.db, ctx.workspace, input.id);

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

  // Check access permission for team members
  await requireFolderAccess(ctx.db, ctx.workspace, input.id);

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

  // Check access permission for team members
  await requireFolderAccess(ctx.db, ctx.workspace, input.id);

  // Use transaction to delete folder, permissions, and update links atomically
  await ctx.db.transaction(async (tx) => {
    // Move all links in this folder to unfoldered (folderId = null)
    await tx
      .update(link)
      .set({ folderId: null })
      .where(and(eq(link.folderId, input.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));

    // Delete folder permissions
    await tx
      .delete(folderPermission)
      .where(eq(folderPermission.folderId, input.id));

    // Delete the folder
    await tx.delete(folder).where(eq(folder.id, input.id));
  });

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

    // Check access permission for team members
    await requireFolderAccess(ctx.db, ctx.workspace, folderId);
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

    // Check access permission for team members
    await requireFolderAccess(ctx.db, ctx.workspace, folderId);
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

/**
 * Get folder permissions (for permission management UI)
 * Only available to team admins and owners
 */
export const getFolderPermissions = async (
  ctx: WorkspaceTRPCContext,
  input: GetFolderPermissionsInput
) => {
  // Require admin/owner role
  requireFolderPermissionManagement(ctx.workspace);

  // Verify folder exists and belongs to workspace
  const folderData = await ctx.db.query.folder.findFirst({
    where: and(
      eq(folder.id, input.folderId),
      workspaceFilter(ctx.workspace, folder.userId, folder.teamId)
    ),
  });

  if (!folderData) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Folder not found",
    });
  }

  // Get permissions with user info
  const permissions = await ctx.db.query.folderPermission.findMany({
    where: eq(folderPermission.folderId, input.folderId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
        },
      },
    },
  });

  return {
    folderId: input.folderId,
    folderName: folderData.name,
    isRestricted: folderData.isRestricted,
    permittedUsers: permissions.map((p) => p.user),
  };
};

/**
 * Update folder permissions (set which members can access the folder)
 * Only available to team admins and owners
 *
 * Permission Semantics:
 * - isRestricted=false: all team members can access (userIds ignored)
 * - isRestricted=true with userIds: only admins/owners + specified users can access
 * - isRestricted=true with empty userIds: only admins/owners can access
 */
export const updateFolderPermissions = async (
  ctx: WorkspaceTRPCContext,
  input: UpdateFolderPermissionsInput
) => {
  // Require admin/owner role
  requireFolderPermissionManagement(ctx.workspace);

  // Verify folder exists and belongs to workspace
  const folderData = await ctx.db.query.folder.findFirst({
    where: and(
      eq(folder.id, input.folderId),
      workspaceFilter(ctx.workspace, folder.userId, folder.teamId)
    ),
  });

  if (!folderData) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Folder not found",
    });
  }

  // De-duplicate userIds (only relevant if isRestricted=true)
  const uniqueUserIds = input.isRestricted ? [...new Set(input.userIds)] : [];

  // Validate userIds are actual team members (if any provided)
  if (uniqueUserIds.length > 0 && ctx.workspace.type === "team" && ctx.workspace.teamId) {
    const validMembers = await ctx.db.query.teamMember.findMany({
      where: and(
        eq(teamMember.teamId, ctx.workspace.teamId),
        inArray(teamMember.userId, uniqueUserIds)
      ),
      columns: { userId: true },
    });

    const validUserIds = new Set(validMembers.map((m) => m.userId));
    const invalidUserIds = uniqueUserIds.filter((id) => !validUserIds.has(id));

    if (invalidUserIds.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Invalid user IDs: ${invalidUserIds.join(", ")}. Users must be team members.`,
      });
    }
  }

  await ctx.db.transaction(async (tx) => {
    // Update the folder's isRestricted flag
    await tx
      .update(folder)
      .set({ isRestricted: input.isRestricted })
      .where(eq(folder.id, input.folderId));

    // Remove all existing permissions for this folder
    await tx
      .delete(folderPermission)
      .where(eq(folderPermission.folderId, input.folderId));

    // If restricted with specific users, create permission records
    if (input.isRestricted && uniqueUserIds.length > 0) {
      await tx.insert(folderPermission).values(
        uniqueUserIds.map((userId) => ({
          folderId: input.folderId,
          userId,
        }))
      );
    }
  });

  return {
    success: true,
    folderId: input.folderId,
    isRestricted: input.isRestricted,
    permittedUserCount: uniqueUserIds.length,
  };
};

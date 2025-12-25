import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";

import { folderPermission } from "@/server/db/schema";

import { isWorkspaceAdmin } from "./permissions";
import type { WorkspaceContext } from "./types";

import type { db as Database } from "@/server/db";

type DatabaseType = typeof Database;

/**
 * Resource-level permission system for folder access control in teams.
 *
 * Permission Semantics:
 * - Folders with NO permission records = visible to ALL team members (default)
 * - Folders with permission records = RESTRICTED to only those users listed
 * - Owners and admins ALWAYS bypass permission checks
 * - Personal workspaces don't use folder permissions (user owns all their folders)
 */

/**
 * Checks if the current user should bypass folder permission checks.
 * Owners and admins always have access to all folders.
 *
 * @param workspace - The current workspace context
 * @returns True if user should bypass permission checks
 */
export function shouldBypassFolderPermissions(
  workspace: WorkspaceContext
): boolean {
  // Personal workspace: no folder permissions (user owns everything)
  if (workspace.type === "personal") {
    return true;
  }

  // Team workspace: owners and admins bypass
  return isWorkspaceAdmin(workspace);
}

/**
 * Checks if a user can access a specific folder.
 *
 * Logic:
 * 1. Personal workspace: always true
 * 2. Team workspace + admin/owner: always true (bypass)
 * 3. Team workspace + member: check if folder has restrictions
 *    - No permission records: accessible (default = all members)
 *    - Has permission records: check if user is in the list
 *
 * @param db - Database instance
 * @param workspace - Workspace context
 * @param folderId - Folder ID to check
 * @returns True if user can access the folder
 */
export async function canAccessFolder(
  db: DatabaseType,
  workspace: WorkspaceContext,
  folderId: number
): Promise<boolean> {
  // Bypass for personal workspace or admin/owner
  if (shouldBypassFolderPermissions(workspace)) {
    return true;
  }

  // Team member: check if folder has restrictions
  const permissions = await db.query.folderPermission.findMany({
    where: eq(folderPermission.folderId, folderId),
  });

  // No permissions set: accessible to all team members (default behavior)
  if (permissions.length === 0) {
    return true;
  }

  // Permissions exist: check if user is in the list
  return permissions.some((p) => p.userId === workspace.userId);
}

/**
 * Requires folder access, throwing an error if user cannot access.
 *
 * @param db - Database instance
 * @param workspace - Workspace context
 * @param folderId - Folder ID to check
 * @throws TRPCError with FORBIDDEN code if access denied
 */
export async function requireFolderAccess(
  db: DatabaseType,
  workspace: WorkspaceContext,
  folderId: number
): Promise<void> {
  const hasAccess = await canAccessFolder(db, workspace, folderId);
  if (!hasAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have permission to access this folder",
    });
  }
}

/**
 * Gets all folder IDs accessible to the current user.
 * Useful for bulk filtering operations (e.g., dashboard link filtering).
 *
 * @param db - Database instance
 * @param workspace - Workspace context
 * @param teamFolderIds - All folder IDs in the team to check
 * @returns Accessible folder IDs
 */
export async function getAccessibleFolderIds(
  db: DatabaseType,
  workspace: WorkspaceContext,
  teamFolderIds: number[]
): Promise<number[]> {
  // Empty list: return empty
  if (teamFolderIds.length === 0) {
    return [];
  }

  // Bypass for personal workspace or admin/owner
  if (shouldBypassFolderPermissions(workspace)) {
    return teamFolderIds;
  }

  // Team member: get all permissions for these folders
  const allPermissions = await db.query.folderPermission.findMany({
    where: inArray(folderPermission.folderId, teamFolderIds),
  });

  // Group permissions by folder ID
  const folderPermissionMap = new Map<number, string[]>();
  for (const perm of allPermissions) {
    if (!folderPermissionMap.has(perm.folderId)) {
      folderPermissionMap.set(perm.folderId, []);
    }
    folderPermissionMap.get(perm.folderId)!.push(perm.userId);
  }

  // Filter to accessible folders
  return teamFolderIds.filter((folderId) => {
    const permittedUsers = folderPermissionMap.get(folderId);

    // No permissions: accessible to all team members (default)
    if (!permittedUsers || permittedUsers.length === 0) {
      return true;
    }

    // Has permissions: check if user is included
    return permittedUsers.includes(workspace.userId);
  });
}

/**
 * Gets the permission status of folders (for UI display).
 * Returns which folders are restricted and who has access.
 *
 * @param db - Database instance
 * @param folderIds - Folder IDs to check
 * @returns Map of folderId to list of permitted userIds (empty array = unrestricted)
 */
export async function getFolderPermissionMap(
  db: DatabaseType,
  folderIds: number[]
): Promise<Map<number, string[]>> {
  if (folderIds.length === 0) {
    return new Map();
  }

  const allPermissions = await db.query.folderPermission.findMany({
    where: inArray(folderPermission.folderId, folderIds),
  });

  // Group by folder ID
  const result = new Map<number, string[]>();

  // Initialize all folders with empty arrays (unrestricted by default)
  for (const folderId of folderIds) {
    result.set(folderId, []);
  }

  // Populate with actual permissions
  for (const perm of allPermissions) {
    const users = result.get(perm.folderId) ?? [];
    users.push(perm.userId);
    result.set(perm.folderId, users);
  }

  return result;
}

/**
 * Validates that user can manage folder permissions.
 * Only admins and owners can manage permissions.
 *
 * @param workspace - Workspace context
 * @throws TRPCError if user cannot manage permissions
 */
export function requireFolderPermissionManagement(
  workspace: WorkspaceContext
): void {
  // Personal workspace: no team permissions to manage
  if (workspace.type === "personal") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Folder permissions only apply to team workspaces",
    });
  }

  // Only admins and owners can manage permissions
  if (!isWorkspaceAdmin(workspace)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only team admins and owners can manage folder permissions",
    });
  }
}

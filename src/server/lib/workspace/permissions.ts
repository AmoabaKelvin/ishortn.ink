import { TRPCError } from "@trpc/server";

import {
  ROLE_PERMISSIONS,
  type WorkspaceContext,
  type WorkspacePermission,
} from "./types";

/**
 * Checks if the current user has a specific permission in the workspace.
 *
 * For personal workspaces: always returns true (owner of personal data)
 * For team workspaces: checks against role-based permissions
 *
 * @param workspace - The current workspace context
 * @param permission - The permission to check
 * @returns True if the user has the permission
 */
export function hasPermission(
  workspace: WorkspaceContext,
  permission: WorkspacePermission
): boolean {
  // Personal workspace: full access to everything
  if (workspace.type === "personal") {
    return true;
  }

  // Team workspace: check role-based permissions
  const rolePermissions = ROLE_PERMISSIONS[workspace.role];
  return rolePermissions.includes(permission);
}

/**
 * Requires a specific permission, throwing an error if not authorized.
 *
 * @param workspace - The current workspace context
 * @param permission - The permission to require
 * @param action - Human-readable description of the action (for error message)
 * @throws TRPCError with FORBIDDEN code if permission is denied
 */
export function requirePermission(
  workspace: WorkspaceContext,
  permission: WorkspacePermission,
  action?: string
): void {
  if (!hasPermission(workspace, permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: action
        ? `You don't have permission to ${action}`
        : `Permission denied: ${permission}`,
    });
  }
}

/**
 * Checks if the user has at least a certain role level.
 *
 * Role hierarchy: owner > admin > member
 *
 * @param workspace - The current workspace context
 * @param requiredRole - The minimum required role
 * @returns True if the user's role is equal or higher
 */
export function hasMinimumRole(
  workspace: WorkspaceContext,
  requiredRole: "owner" | "admin" | "member"
): boolean {
  // Personal workspace: always owner
  if (workspace.type === "personal") {
    return true;
  }

  const roleHierarchy = { owner: 3, admin: 2, member: 1 };
  const userRoleLevel = roleHierarchy[workspace.role];
  const requiredRoleLevel = roleHierarchy[requiredRole];

  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Requires at least a certain role level, throwing an error if not met.
 *
 * @param workspace - The current workspace context
 * @param requiredRole - The minimum required role
 * @param action - Human-readable description of the action (for error message)
 * @throws TRPCError with FORBIDDEN code if role requirement is not met
 */
export function requireMinimumRole(
  workspace: WorkspaceContext,
  requiredRole: "owner" | "admin" | "member",
  action?: string
): void {
  if (!hasMinimumRole(workspace, requiredRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: action
        ? `${action} requires ${requiredRole} role or higher`
        : `This action requires ${requiredRole} role or higher`,
    });
  }
}

/**
 * Checks if the user is the owner of the workspace.
 *
 * @param workspace - The current workspace context
 * @returns True if the user is the owner
 */
export function isWorkspaceOwner(workspace: WorkspaceContext): boolean {
  return workspace.role === "owner";
}

/**
 * Checks if the user is an admin or owner of the workspace.
 *
 * @param workspace - The current workspace context
 * @returns True if the user is admin or owner
 */
export function isWorkspaceAdmin(workspace: WorkspaceContext): boolean {
  return workspace.role === "owner" || workspace.role === "admin";
}

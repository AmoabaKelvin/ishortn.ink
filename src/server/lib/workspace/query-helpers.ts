import { and, eq, isNull, type SQL } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";

import type { WorkspaceContext } from "./types";

/**
 * Builds a WHERE clause for workspace-scoped queries.
 *
 * For personal workspaces: WHERE teamId IS NULL AND userId = <userId>
 * For team workspaces: WHERE teamId = <teamId>
 *
 * @param workspace - The current workspace context
 * @param userIdColumn - The userId column from the table
 * @param teamIdColumn - The teamId column from the table
 * @returns SQL condition for filtering by workspace
 */
export function workspaceFilter<
  TUserId extends MySqlColumn,
  TTeamId extends MySqlColumn,
>(
  workspace: WorkspaceContext,
  userIdColumn: TUserId,
  teamIdColumn: TTeamId
): SQL {
  if (workspace.type === "team") {
    // Team workspace: only show team resources
    return eq(teamIdColumn, workspace.teamId);
  } else {
    // Personal workspace: only show personal resources (teamId = null)
    return and(eq(userIdColumn, workspace.userId), isNull(teamIdColumn))!;
  }
}

/**
 * Gets the ownership values to insert when creating a new resource.
 *
 * For personal workspaces: { userId: <userId>, teamId: null }
 * For team workspaces: { userId: <userId>, teamId: <teamId> }
 *
 * Note: userId is always set to the current user (for audit trail in teams)
 *
 * @param workspace - The current workspace context
 * @returns Object with userId and teamId values
 */
export function workspaceOwnership(workspace: WorkspaceContext): {
  userId: string;
  teamId: number | null;
} {
  return {
    userId: workspace.userId,
    teamId: workspace.type === "team" ? workspace.teamId : null,
  };
}

/**
 * Gets the effective plan for the current workspace.
 *
 * For personal workspaces: returns the user's actual plan
 * For team workspaces: always returns "ultra" (teams require Ultra)
 *
 * @param workspace - The current workspace context
 * @returns The effective plan for feature gating
 */
export function getWorkspacePlan(workspace: WorkspaceContext): string {
  return workspace.type === "team" ? "ultra" : workspace.plan;
}

/**
 * Checks if the current workspace has a paid plan.
 *
 * @param workspace - The current workspace context
 * @returns True if the workspace has pro or ultra plan
 */
export function workspaceHasPaidPlan(workspace: WorkspaceContext): boolean {
  const plan = getWorkspacePlan(workspace);
  return plan === "pro" || plan === "ultra";
}

/**
 * Checks if the current workspace has unlimited features (Ultra plan).
 *
 * @param workspace - The current workspace context
 * @returns True if the workspace has ultra plan
 */
export function workspaceHasUltraPlan(workspace: WorkspaceContext): boolean {
  return getWorkspacePlan(workspace) === "ultra";
}

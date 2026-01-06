import { and, count, eq, isNull } from "drizzle-orm";

import { getPlanCaps, resolvePlan, type Plan } from "@/lib/billing/plans";
import { folder, type Subscription } from "@/server/db/schema";
import {
  getUserPlanContext,
  normalizeMonthlyEventCount,
  normalizeMonthlyLinkCount,
} from "@/server/lib/user-plan";
import { workspaceFilter, type WorkspaceContext } from "@/server/lib/workspace";

import type { db } from "@/server/db";

type Database = typeof db;
type PlanCaps = ReturnType<typeof getPlanCaps>;

interface UsageInfo {
  count: number;
  limit: number | null;
}

// Effective subscription can be the actual subscription or a synthetic one for team workspaces
type EffectiveSubscription =
  | Subscription
  | (Partial<Subscription> & { status: string; plan: "ultra" })
  | null;

interface SubscriptionDetails {
  subscriptions: EffectiveSubscription;
  plan: Plan;
  caps: PlanCaps;
  usage: {
    links: UsageInfo;
    events: UsageInfo;
    folders: UsageInfo;
  };
  monthlyLinkCount: number;
  isTeamWorkspace: boolean;
  canCreateTeam: boolean;
}

/**
 * Fetches user record with subscriptions
 */
export async function getUser(db: Database, userId: string) {
  const userRecord = await db.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, userId),
    with: {
      subscriptions: true,
    },
  });

  if (!userRecord) {
    throw new Error("User not found");
  }

  return userRecord;
}

/**
 * Resolves the effective plan for a workspace context
 * Team workspaces always get Ultra features
 */
export async function resolvePlanForWorkspace(
  workspace: WorkspaceContext,
  userId: string,
  userSubscription: Subscription | null,
  db: Database
): Promise<{ plan: Plan; personalPlan: Plan; caps: PlanCaps }> {
  const isTeamWorkspace = workspace.type === "team";
  const planCtx = await getUserPlanContext(userId, db);

  // Personal plan is needed for features like team creation
  const personalPlan = planCtx?.plan ?? resolvePlan(userSubscription);

  // Effective plan considers workspace context
  const plan = isTeamWorkspace ? "ultra" : personalPlan;
  const caps = getPlanCaps(plan);

  return { plan, personalPlan, caps };
}

/**
 * Calculates usage metrics for a workspace
 */
export async function calculateWorkspaceUsage(
  workspace: WorkspaceContext,
  userId: string,
  db: Database
): Promise<{ monthlyLinkCount: number; monthlyEventCount: number; folderCount: number }> {
  const isTeamWorkspace = workspace.type === "team";

  let monthlyLinkCount = 0;
  let monthlyEventCount = 0;
  let folderCount = 0;

  if (!isTeamWorkspace) {
    // Personal workspace: get user's personal usage
    const planCtx = await getUserPlanContext(userId, db);

    if (planCtx) {
      const [linkCount, eventCount, folderCountResult] = await Promise.all([
        normalizeMonthlyLinkCount(planCtx, db),
        normalizeMonthlyEventCount(planCtx, db),
        db
          .select({ count: count() })
          .from(folder)
          .where(and(eq(folder.userId, userId), isNull(folder.teamId))),
      ]);

      monthlyLinkCount = linkCount;
      monthlyEventCount = eventCount;
      folderCount = Number(folderCountResult?.[0]?.count ?? 0);
    }
  } else {
    // Team workspace: get workspace folder count (for display purposes)
    const folderCountResult = await db
      .select({ count: count() })
      .from(folder)
      .where(workspaceFilter(workspace, folder.userId, folder.teamId));

    folderCount = Number(folderCountResult?.[0]?.count ?? 0);
  }

  return { monthlyLinkCount, monthlyEventCount, folderCount };
}

/**
 * Builds the effective subscription object
 * For team workspaces, creates a synthetic Ultra subscription
 */
export function buildEffectiveSubscription(
  workspace: WorkspaceContext,
  userSubscription: Subscription | null
): EffectiveSubscription {
  const isTeamWorkspace = workspace.type === "team";

  if (isTeamWorkspace) {
    return {
      ...(userSubscription ?? {}),
      status: "active",
      plan: "ultra" as const,
    };
  }

  return userSubscription;
}

/**
 * Builds the complete subscription details response
 */
export function buildSubscriptionDetails(
  workspace: WorkspaceContext,
  userSubscription: Subscription | null,
  plan: Plan,
  personalPlan: Plan,
  caps: PlanCaps,
  usage: { monthlyLinkCount: number; monthlyEventCount: number; folderCount: number }
): SubscriptionDetails {
  const isTeamWorkspace = workspace.type === "team";
  const effectiveSubscriptions = buildEffectiveSubscription(workspace, userSubscription);

  return {
    subscriptions: effectiveSubscriptions,
    plan,
    caps,
    usage: {
      links: {
        count: usage.monthlyLinkCount,
        limit: isTeamWorkspace ? null : (caps.linksLimit ?? null),
      },
      events: {
        count: usage.monthlyEventCount,
        limit: isTeamWorkspace ? null : (caps.eventsLimit ?? null),
      },
      folders: {
        count: usage.folderCount,
        limit: isTeamWorkspace ? null : (caps.folderLimit ?? null),
      },
    },
    monthlyLinkCount: usage.monthlyLinkCount,
    isTeamWorkspace,
    canCreateTeam: personalPlan === "ultra",
  };
}

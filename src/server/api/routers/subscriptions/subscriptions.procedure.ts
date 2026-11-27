import { and, count, eq, isNull } from "drizzle-orm";

import {
  effectivePlan,
  graceAction,
  isGraceActive,
  paidPlan,
  planAtLeast,
  teamGraceAction,
} from "@/lib/billing/entitlements";
import { getPlanCaps, getSubscriptionMode } from "@/lib/billing/plans";
import { companyEmailDomain } from "@/lib/email/company-domain";
import { folder } from "@/server/db/schema";
import { getEventTrackingPause, nextEventCountReset } from "@/server/lib/event-usage";
import {
  getUserPlanContext,
  normalizeMonthlyEventCount,
  normalizeMonthlyLinkCount,
} from "@/server/lib/user-plan";
import { workspaceFilter } from "@/server/lib/workspace";

import { createTRPCRouter, workspaceProcedure } from "../../trpc";
import { countWorkspaceQrCodes } from "../qrcode/qrcode.service";

export const subscriptionsRouter = createTRPCRouter({
  // Grace-period notice for the dashboard banner (see src/lib/billing/entitlements.ts).
  entitlementNotice: workspaceProcedure.query(async ({ ctx }) => {
    if (ctx.workspace.type === "team") {
      const { readOnly, ownerGraceEndsAt, role, team } = ctx.workspace;
      // While a lapsed owner is in their own grace the team still reads as Ultra,
      // but its grace (started with the owner's) is already running.
      const endsAt =
        ownerGraceEndsAt ??
        (isGraceActive(team.ownerPlanGraceEndsAt) ? team.ownerPlanGraceEndsAt : null);
      if (!readOnly && !endsAt) return null;
      const isOwner = role === "owner";
      // The owner's own failed Ultra payment is fixed on that subscription, not
      // with a new checkout (which pricing would start once it reads as free).
      const ownerSubscription = isOwner
        ? await ctx.db.query.subscription.findFirst({
            where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
          })
        : undefined;
      return {
        type: "team" as const,
        readOnly,
        endsAt,
        isOwner,
        action: isOwner ? teamGraceAction(ownerSubscription ?? null) : ("upgrade" as const),
      };
    }

    const userRecord = await ctx.db.query.user.findFirst({
      where: (table, { eq }) => eq(table.id, ctx.auth.userId),
      columns: { planGracePlan: true, planGraceEndsAt: true, planGraceReason: true },
      with: { subscriptions: true },
    });
    const { planGracePlan, planGraceEndsAt, planGraceReason } = userRecord ?? {};
    if (
      !planGracePlan ||
      !planGraceEndsAt ||
      !isGraceActive(planGraceEndsAt) ||
      planAtLeast(paidPlan(userRecord?.subscriptions ?? null), planGracePlan)
    ) {
      return null;
    }
    const reason = planGraceReason ?? "lapsed";
    return {
      type: "account" as const,
      plan: planGracePlan,
      endsAt: planGraceEndsAt,
      reason,
      action: graceAction(reason, userRecord?.subscriptions, planGracePlan),
    };
  }),

  // Use workspaceProcedure to be workspace-aware
  get: workspaceProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.userId;

    const userRecord = await ctx.db.query.user.findFirst({
      where: (table, { eq }) => eq(table.id, userId),
      with: {
        subscriptions: true,
      },
    });

    if (!userRecord) {
      throw new Error("User not found");
    }

    // Team workspaces take their plan from the team owner (ctx.workspace.plan)
    const isTeamWorkspace = ctx.workspace.type === "team";
    const planCtx = await getUserPlanContext(userId, ctx.db);

    // Personal plan is needed for features like team creation
    const personalPlan =
      planCtx?.plan ?? effectivePlan(userRecord.subscriptions ?? null, userRecord);

    // Effective plan considers workspace context
    const plan = ctx.workspace.plan;
    const caps = getPlanCaps(plan);
    const eventLimit = isTeamWorkspace ? null : (caps.eventsLimit ?? null);

    // For team workspaces, don't show personal usage counts - they're not relevant
    // Team workspaces have unlimited resources (Ultra plan)
    let monthlyLinkCount = 0;
    let monthlyEventCount = 0;
    let folderCount = 0;
    let qrCodeCount = 0;

    if (!isTeamWorkspace && planCtx) {
      // Personal workspace: get user's personal usage
      // Filter out team folders from personal counts
      const [linkCount, eventCount, folderCountResult, qrCodeCountResult] = await Promise.all([
        normalizeMonthlyLinkCount(planCtx, ctx.db),
        normalizeMonthlyEventCount(planCtx, ctx.db),
        ctx.db
          .select({ count: count() })
          .from(folder)
          .where(and(eq(folder.userId, userId), isNull(folder.teamId))),
        countWorkspaceQrCodes(ctx),
      ]);

      monthlyLinkCount = linkCount;
      monthlyEventCount = eventCount;
      folderCount = Number(folderCountResult?.[0]?.count ?? 0);
      qrCodeCount = qrCodeCountResult;
    } else if (isTeamWorkspace) {
      // Team workspace: get workspace folder count (for display purposes)
      const folderCountResult = await ctx.db
        .select({ count: count() })
        .from(folder)
        .where(workspaceFilter(ctx.workspace, folder.userId, folder.teamId));

      folderCount = Number(folderCountResult?.[0]?.count ?? 0);
    }

    // For team workspaces, create an effective subscription that reflects Ultra status
    // This ensures UI components that check subscriptions.status and subscriptions.plan work correctly
    // Guard against null subscriptions when spreading
    const effectiveSubscriptions = isTeamWorkspace
      ? {
          ...userRecord.subscriptions,
          status: "active",
          plan,
        }
      : userRecord.subscriptions;

    return {
      subscriptions: effectiveSubscriptions,
      plan,
      caps,
      usage: {
        links: {
          count: monthlyLinkCount,
          // Team workspaces have no limits (null means unlimited)
          limit: isTeamWorkspace
            ? null
            : ((planCtx ? planCtx.linksLimit : caps.linksLimit) ?? null),
        },
        events: {
          count: monthlyEventCount,
          limit: eventLimit,
          resetsAt: nextEventCountReset(new Date()),
          paused: getEventTrackingPause({
            count: monthlyEventCount,
            limit: eventLimit,
            dropped: planCtx?.userRecord.droppedEventCount ?? 0,
            pausedAt: planCtx?.userRecord.eventTrackingPausedAt ?? null,
          }),
        },
        folders: {
          count: folderCount,
          limit: isTeamWorkspace ? null : (caps.folderLimit ?? null),
        },
        qrCodes: {
          count: qrCodeCount,
          limit: isTeamWorkspace ? null : (caps.qrCodeLimit ?? null),
        },
      },
      monthlyLinkCount,
      // Include workspace type for UI components that need to know
      isTeamWorkspace,
      // Billing actions always act on the personal subscription.
      subscriptionMode: getSubscriptionMode(userRecord.subscriptions ?? null),
      // Whether the user can create teams (based on personal subscription, not workspace)
      canCreateTeam: personalPlan === "ultra",
      // Read from the auth context (no query); hides billing offers on moderated accounts.
      isRestricted: ctx.restrictedAt !== null,
      // Null for free-mail addresses; the link-ready dialog offers go.<domain> to the rest.
      companyEmailDomain: companyEmailDomain(userRecord.email),
    };
  }),
});

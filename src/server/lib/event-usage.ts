import { eq } from "drizzle-orm";

import { Plan, PLAN_CAPS } from "@/lib/billing/plans";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

import { getUserPlanContext, normalizeMonthlyEventCount } from "./user-plan";

type DbClient = typeof db;

type EventUsageResult = {
  allowed: boolean;
  capReached: boolean;
  plan?: Plan;
  caps?: (typeof PLAN_CAPS)[Plan];
  limit?: number;
  currentCount: number;
  alertLevelTriggered?: number;
  userEmail?: string | null;
  userName?: string | null;
};

const ALERT_THRESHOLDS = [80, 90, 100];

function nextAlertLevel(
  limit: number,
  newCount: number,
  previousLevel: number
): number | null {
  const percentage = Math.floor((newCount / limit) * 100);
  const threshold = ALERT_THRESHOLDS.find(
    (level) => percentage >= level && previousLevel < level
  );
  return threshold ?? null;
}

function shouldTrackCount(plan: Plan): boolean {
  return PLAN_CAPS[plan].eventsLimit !== undefined;
}

export async function registerEventUsage(
  userId: string,
  dbClient: DbClient = db
): Promise<EventUsageResult> {
  const ctx = await getUserPlanContext(userId, dbClient);

  if (!ctx) {
    return {
      allowed: false,
      capReached: true,
      currentCount: 0,
    };
  }

  const { plan, caps } = ctx;
  const limit = caps.eventsLimit;
  const currentCount = await normalizeMonthlyEventCount(ctx, dbClient);
  const trackUsage = shouldTrackCount(plan);

  if (trackUsage && limit !== undefined && currentCount >= limit) {
    // Check if we need to send the 100% alert even though cap is reached
    const previousLevel = ctx.userRecord.eventUsageAlertLevel ?? 0;
    let alertLevel: number | undefined;

    if (previousLevel < 100) {
      alertLevel = 100;
      // Update the alert level so we don't send again
      await dbClient
        .update(user)
        .set({ eventUsageAlertLevel: 100 })
        .where(eq(user.id, userId));
    }

    return {
      allowed: false,
      capReached: true,
      plan,
      caps,
      limit,
      currentCount,
      alertLevelTriggered: alertLevel,
      userEmail: ctx.userRecord.email,
      userName: ctx.userRecord.name,
    };
  }

  const newCount = trackUsage ? currentCount + 1 : currentCount;
  let alertLevel: number | null = null;

  if (trackUsage && limit !== undefined) {
    const updates: Record<string, unknown> = {
      monthlyEventCount: newCount,
    };

    const previousLevel = ctx.userRecord.eventUsageAlertLevel ?? 0;
    alertLevel = nextAlertLevel(limit, newCount, previousLevel);

    if (alertLevel && alertLevel > previousLevel) {
      updates.eventUsageAlertLevel = alertLevel;
    }

    await dbClient.update(user).set(updates).where(eq(user.id, userId));
  }

  return {
    allowed: true,
    capReached: false,
    plan,
    caps,
    limit,
    currentCount: newCount,
    alertLevelTriggered: alertLevel ?? undefined,
    userEmail: ctx.userRecord.email,
    userName: ctx.userRecord.name,
  };
}

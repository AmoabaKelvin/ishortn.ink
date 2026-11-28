import { eq, sql } from "drizzle-orm";

import { getSubscriptionMode } from "@/lib/billing/plans";
import { user } from "@/server/db/schema";

import { type DbClient, getUserPlanContext, normalizeMonthlyEventCount } from "./user-plan";

import type { SendEventUsageEmailInput } from "./notifications/event-usage";
import type { MySqlUpdateSetSource } from "drizzle-orm/mysql-core";

export type EventUsageReservation = {
  /** How many of the requested events fit under the owner's monthly cap. */
  allowed: number;
  alert: SendEventUsageEmailInput | null;
};

const ALERT_THRESHOLDS = [80, 90, 100];

function nextAlertLevel(limit: number, newCount: number, previousLevel: number): number | null {
  const percentage = Math.floor((newCount / limit) * 100);
  const threshold = ALERT_THRESHOLDS.find((level) => percentage >= level && previousLevel < level);
  return threshold ?? null;
}

export function allocateEventQuota(input: {
  currentCount: number;
  limit: number;
  requested: number;
  previousAlertLevel: number;
}) {
  const { currentCount, limit, requested, previousAlertLevel } = input;
  const allowed = Math.max(0, Math.min(requested, limit - currentCount));
  const newCount = currentCount + allowed;
  return {
    allowed,
    dropped: requested - allowed,
    newCount,
    alertLevel: nextAlertLevel(limit, newCount, previousAlertLevel),
  };
}

export type EventTrackingPause = { dropped: number; pausedAt: Date; resetsAt: Date };

/** Tracking is paused when the owner is at their cap and events have been dropped this month. */
export function getEventTrackingPause(input: {
  count: number;
  limit: number | null;
  dropped: number;
  pausedAt: Date | null;
  now?: Date;
}): EventTrackingPause | null {
  const { count, limit, dropped, pausedAt, now = new Date() } = input;
  if (limit === null || count < limit || dropped <= 0 || !pausedAt) return null;
  return { dropped, pausedAt, resetsAt: nextEventCountReset(now) };
}

// Counters reset lazily on the first event after the month starts (normalizeMonthlyEventCount).
export function nextEventCountReset(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/**
 * Charges up to `requested` events to the owner's monthly quota in one atomic increment, and
 * counts the rest as dropped.
 */
export async function reserveEventUsage(
  userId: string,
  requested: number,
  dbClient: DbClient,
): Promise<EventUsageReservation> {
  const ctx = await getUserPlanContext(userId, dbClient);
  if (!ctx) return { allowed: 0, alert: null };

  const { plan, caps } = ctx;
  const limit = caps.eventsLimit;
  const currentCount = await normalizeMonthlyEventCount(ctx, dbClient);

  if (limit === undefined) {
    return { allowed: requested, alert: null };
  }

  const previousAlertLevel = ctx.userRecord.eventUsageAlertLevel ?? 0;
  const { allowed, dropped, newCount, alertLevel } = allocateEventQuota({
    currentCount,
    limit,
    requested,
    previousAlertLevel,
  });

  if (allowed > 0 || dropped > 0 || alertLevel !== null) {
    const usageUpdate: MySqlUpdateSetSource<typeof user> = {
      monthlyEventCount: sql`${user.monthlyEventCount} + ${allowed}`,
    };
    if (alertLevel !== null) usageUpdate.eventUsageAlertLevel = alertLevel;
    if (dropped > 0) {
      // Counted in the same update as the charge so the dashboard can show how much went missing.
      usageUpdate.droppedEventCount = sql`coalesce(${user.droppedEventCount}, 0) + ${dropped}`;
      usageUpdate.eventTrackingPausedAt = sql`coalesce(${user.eventTrackingPausedAt}, now())`;
    }
    await dbClient.update(user).set(usageUpdate).where(eq(user.id, userId));
  }

  // The level is still recorded when emails are off, so turning them back on doesn't replay it.
  const alert =
    alertLevel !== null && ctx.userRecord.email && ctx.userRecord.productEmailsEnabled
      ? {
          userId,
          resetsAt: nextEventCountReset(new Date()),
          threshold: alertLevel,
          limit,
          currentCount: newCount,
          plan,
          subscriptionMode: getSubscriptionMode(ctx.subscription),
          email: ctx.userRecord.email,
        }
      : null;

  return { allowed, alert };
}

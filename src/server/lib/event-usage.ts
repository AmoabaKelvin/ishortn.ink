import { eq, sql } from "drizzle-orm";

import { user } from "@/server/db/schema";

import { type DbClient, getUserPlanContext, normalizeMonthlyEventCount } from "./user-plan";

import type { SendEventUsageEmailInput } from "./notifications/event-usage";

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
}): { allowed: number; newCount: number; alertLevel: number | null } {
  const { currentCount, limit, requested, previousAlertLevel } = input;
  const allowed = Math.max(0, Math.min(requested, limit - currentCount));
  const newCount = currentCount + allowed;
  return { allowed, newCount, alertLevel: nextAlertLevel(limit, newCount, previousAlertLevel) };
}

/** Charges up to `requested` events to the owner's monthly quota in one atomic increment. */
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
  const { allowed, newCount, alertLevel } = allocateEventQuota({
    currentCount,
    limit,
    requested,
    previousAlertLevel,
  });

  if (allowed > 0 || alertLevel !== null) {
    await dbClient
      .update(user)
      .set({
        monthlyEventCount: sql`${user.monthlyEventCount} + ${allowed}`,
        ...(alertLevel !== null ? { eventUsageAlertLevel: alertLevel } : {}),
      })
      .where(eq(user.id, userId));
  }

  const alert =
    alertLevel !== null && ctx.userRecord.email
      ? {
          threshold: alertLevel,
          limit,
          currentCount: newCount,
          plan,
          email: ctx.userRecord.email,
          name: ctx.userRecord.name,
        }
      : null;

  return { allowed, alert };
}

import { eq } from "drizzle-orm";

import { getPlanCaps, Plan, resolvePlan } from "@/lib/billing/plans";
import { db } from "@/server/db";
import { subscription, user } from "@/server/db/schema";

import type { PLAN_CAPS } from "@/lib/billing/plans";
import type { Subscription, User } from "@/server/db/schema";

type DbClient = typeof db;

/**
 * Hot-path paid-plan check used by the redirect pipeline. Avoids the full
 * UserPlanContext query — we only need a boolean. Team-owned links
 * short-circuit without a DB hit since teams are always on Ultra.
 */
export async function isOwnerOnPaidPlan(
  userId: string,
  teamId: number | null,
  dbClient: DbClient = db,
): Promise<boolean> {
  if (teamId !== null) return true;

  const sub = await dbClient.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });

  return resolvePlan(sub ?? null) !== "free";
}

export type UserPlanContext = {
  userRecord: User;
  subscription: Subscription | null;
  plan: Plan;
  caps: (typeof PLAN_CAPS)[Plan];
};

const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

export async function getUserPlanContext(
  userId: string,
  dbClient: DbClient = db
): Promise<UserPlanContext | null> {
  const userRecord = await dbClient.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, userId),
    with: {
      subscriptions: true,
    },
  });

  if (!userRecord) return null;

  const subscription = userRecord.subscriptions ?? null;
  const plan = resolvePlan(subscription);

  return {
    userRecord,
    subscription,
    plan,
    caps: getPlanCaps(plan),
  };
}

export async function normalizeMonthlyEventCount(
  ctx: UserPlanContext,
  dbClient: DbClient = db
): Promise<number> {
  const monthStart = getMonthStart();
  const lastReset =
    ctx.userRecord.lastEventCountReset ??
    ctx.userRecord.createdAt ??
    new Date();

  if (lastReset < monthStart) {
    await dbClient
      .update(user)
      .set({
        monthlyEventCount: 0,
        lastEventCountReset: new Date(),
        eventUsageAlertLevel: 0,
      })
      .where(eq(user.id, ctx.userRecord.id));

    return 0;
  }

  return ctx.userRecord.monthlyEventCount ?? 0;
}

export async function normalizeMonthlyLinkCount(
  ctx: UserPlanContext,
  dbClient: DbClient = db
): Promise<number> {
  const monthStart = getMonthStart();
  const lastReset =
    ctx.userRecord.lastLinkCountReset ?? ctx.userRecord.createdAt ?? new Date();

  if (lastReset < monthStart) {
    await dbClient
      .update(user)
      .set({
        monthlyLinkCount: 0,
        lastLinkCountReset: new Date(),
      })
      .where(eq(user.id, ctx.userRecord.id));

    return 0;
  }

  return ctx.userRecord.monthlyLinkCount ?? 0;
}

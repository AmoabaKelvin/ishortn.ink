import { eq } from "drizzle-orm";

import { getPlanCaps, Plan, resolvePlan } from "@/lib/billing/plans";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";

import type { PLAN_CAPS } from "@/lib/billing/plans";
import type { Subscription, User } from "@/server/db/schema";

type DbClient = typeof db;

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

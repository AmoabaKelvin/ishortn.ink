import { TRPCError } from "@trpc/server";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import { effectivePlan } from "@/lib/billing/entitlements";
import { getPlanCaps, Plan, resolvePlan } from "@/lib/billing/plans";
import { db } from "@/server/db";
import { subscription, user } from "@/server/db/schema";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";

import type { PLAN_CAPS } from "@/lib/billing/plans";
import type { Subscription, User } from "@/server/db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | TransactionClient;

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
  linksLimit: number | undefined;
};

const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

export async function getUserPlanContext(
  userId: string,
  dbClient: DbClient = db,
): Promise<UserPlanContext | null> {
  const userRecord = await dbClient.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, userId),
    with: {
      subscriptions: true,
    },
  });

  if (!userRecord) return null;

  const subscription = userRecord.subscriptions ?? null;
  const plan = effectivePlan(subscription, userRecord);

  return {
    userRecord,
    subscription,
    plan,
    caps: getPlanCaps(plan),
    linksLimit: getPlanCaps(plan).linksLimit,
  };
}

export async function normalizeMonthlyEventCount(
  ctx: UserPlanContext,
  dbClient: DbClient = db,
): Promise<number> {
  const monthStart = getMonthStart();
  const lastReset = ctx.userRecord.lastEventCountReset ?? ctx.userRecord.createdAt ?? new Date();

  if (lastReset < monthStart) {
    await dbClient
      .update(user)
      .set({
        monthlyEventCount: 0,
        lastEventCountReset: new Date(),
        eventUsageAlertLevel: 0,
        droppedEventCount: 0,
        eventTrackingPausedAt: null,
      })
      .where(eq(user.id, ctx.userRecord.id));

    return 0;
  }

  return ctx.userRecord.monthlyEventCount ?? 0;
}

/** Links counted this month, without the write normalizeMonthlyLinkCount does on a new month. */
export function linksUsedThisMonth(
  userRecord: Pick<User, "monthlyLinkCount" | "lastLinkCountReset" | "createdAt">,
): number {
  const lastReset = userRecord.lastLinkCountReset ?? userRecord.createdAt ?? new Date();
  return lastReset < getMonthStart() ? 0 : (userRecord.monthlyLinkCount ?? 0);
}

export async function normalizeMonthlyLinkCount(
  ctx: UserPlanContext,
  dbClient: DbClient = db,
): Promise<number> {
  const monthStart = getMonthStart();
  const lastReset = ctx.userRecord.lastLinkCountReset ?? ctx.userRecord.createdAt ?? new Date();

  if (lastReset < monthStart) {
    // `ctx` may come from a snapshot read, so re-check the reset date under the
    // row lock: when a parallel request has already reset (and counted) this
    // month, matching 0 rows here keeps its count instead of zeroing it again.
    const [result] = await dbClient
      .update(user)
      .set({
        monthlyLinkCount: 0,
        lastLinkCountReset: new Date(),
      })
      .where(
        and(
          eq(user.id, ctx.userRecord.id),
          or(isNull(user.lastLinkCountReset), lt(user.lastLinkCountReset, monthStart)),
        ),
      );

    if (result.affectedRows > 0) return 0;

    const [current] = await dbClient
      .select({ monthlyLinkCount: user.monthlyLinkCount })
      .from(user)
      .where(eq(user.id, ctx.userRecord.id))
      .for("update");
    return current?.monthlyLinkCount ?? 0;
  }

  return ctx.userRecord.monthlyLinkCount ?? 0;
}

export function monthlyLinkLimitMessage(plan: Plan, limit: number): string {
  const limitText = limit.toLocaleString();
  return plan === "free"
    ? `You've reached your monthly limit of ${limitText} links. Upgrade to Pro for more.`
    : `You've reached your monthly limit of ${limitText} links. Upgrade to Ultra for unlimited links.`;
}

/**
 * Checks the user's monthly link quota and counts one link against it in a
 * single conditional UPDATE, so parallel requests can't overshoot the cap.
 * Call it inside the transaction that inserts the link: the row lock taken by
 * the UPDATE serialises concurrent callers, and a failed insert rolls the
 * count back. Plans without a limit are not counted. Throws
 * TRPCError("FORBIDDEN") with the user-facing message when the limit is
 * reached, and "NOT_FOUND" when the user doesn't exist.
 */
export async function reserveMonthlyLinkSlot(
  userId: string,
  dbClient: DbClient = db,
): Promise<UserPlanContext> {
  const planCtx = await getUserPlanContext(userId, dbClient);
  if (!planCtx) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }

  const limit = planCtx.linksLimit;
  if (limit === undefined) return planCtx;

  await normalizeMonthlyLinkCount(planCtx, dbClient);

  const [result] = await dbClient
    .update(user)
    .set({ monthlyLinkCount: sql`coalesce(${user.monthlyLinkCount}, 0) + 1` })
    .where(and(eq(user.id, userId), lt(sql`coalesce(${user.monthlyLinkCount}, 0)`, limit)));

  if (result.affectedRows === 0) {
    // Root db, not dbClient: the caller's transaction rolls back on this throw.
    await recordPlanLimitHit({ userId, limitKey: "monthly_links", plan: planCtx.plan });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: monthlyLinkLimitMessage(planCtx.plan, limit),
    });
  }

  return planCtx;
}

/**
 * reserveMonthlyLinkSlot in one statement, for callers that already know the plan (API tokens
 * load it with the token): applies the new-month reset and counts one link in a single
 * conditional UPDATE, so it needs no transaction and parallel requests can't overshoot the cap.
 * Plans without a limit are not counted. Pair a failed insert with releaseMonthlyLinkSlot.
 * Throws TRPCError("FORBIDDEN") with the user-facing message when the limit is reached.
 */
export async function claimMonthlyLinkSlot(
  userId: string,
  plan: Plan,
  dbClient: DbClient = db,
): Promise<void> {
  const limit = getPlanCaps(plan).linksLimit;
  if (limit === undefined) return;

  const monthStart = getMonthStart();
  // Same fallback as normalizeMonthlyLinkCount: a user never reset counts from sign-up.
  const isNewMonth = or(
    lt(user.lastLinkCountReset, monthStart),
    and(isNull(user.lastLinkCountReset), lt(user.createdAt, monthStart)),
  );
  const usedThisMonth = sql`(case when ${isNewMonth} then 0 else coalesce(${user.monthlyLinkCount}, 0) end)`;

  // MySQL applies SET assignments left to right and later ones see earlier results. Drizzle
  // emits them in schema order, monthlyLinkCount before lastLinkCountReset, so the count is
  // computed against the old reset date.
  const [result] = await dbClient
    .update(user)
    .set({
      monthlyLinkCount: sql`${usedThisMonth} + 1`,
      lastLinkCountReset: sql`case when ${isNewMonth} then ${sql.param(new Date(), user.lastLinkCountReset)} else ${user.lastLinkCountReset} end`,
    })
    .where(and(eq(user.id, userId), lt(usedThisMonth, limit)));

  if (result.affectedRows === 0) {
    await recordPlanLimitHit({ userId, limitKey: "monthly_links", plan });
    throw new TRPCError({ code: "FORBIDDEN", message: monthlyLinkLimitMessage(plan, limit) });
  }
}

/** Gives back a slot claimMonthlyLinkSlot took when the link it was for wasn't created. */
export async function releaseMonthlyLinkSlot(
  userId: string,
  plan: Plan,
  dbClient: DbClient = db,
): Promise<void> {
  if (getPlanCaps(plan).linksLimit === undefined) return;
  await dbClient
    .update(user)
    .set({ monthlyLinkCount: sql`greatest(coalesce(${user.monthlyLinkCount}, 0) - 1, 0)` })
    .where(eq(user.id, userId));
}

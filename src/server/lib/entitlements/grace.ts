import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";

import { planGraceSubject } from "@/emails/_components/plan-grace-subject";
import {
  describeOverPlanFeature,
  dueGraceEmail,
  effectivePlan,
  EMPTY_USAGE,
  GRACE_EMAIL_STAGE,
  GRACE_PERIOD_MS,
  graceAction,
  graceChangeAfterBillingEvent,
  higherPlan,
  isGraceActive,
  isPausedSubscription,
  lapseEndedByPayment,
  NO_GRACE,
  overPlanGraceFeatures,
  paidPlan,
  PLAN_NAMES,
  planAtLeast,
  planBeforeBillingEvent,
  subscribedPlan,
  teamGraceAction,
  updatePaymentPath,
} from "@/lib/billing/entitlements";
import { getPlanCaps } from "@/lib/billing/plans";
import { getAppUrl } from "@/lib/constants/domains";
import { EMAIL_LINKS, emailLinkUrl } from "@/lib/email/links";
import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { db } from "@/server/db";
import { subscription, team, user } from "@/server/db/schema";
import { renderEmail } from "@/server/lib/notifications/render-email";
import { getResend } from "@/server/lib/notifications/resend-client";
import { EMAIL_FROM_SYSTEM, withReplyTo } from "@/server/lib/notifications/send-email";

import {
  FAILED_PAYMENT_STATUSES,
  isEndedProviderStatus,
  lookupProviderSubscription,
  ProviderSubscriptionNotFoundError,
  providerEndedSubscription,
} from "./provider-status";
import { getPlanUsageByUser } from "./usage";

import type { ProviderSubscriptionLookup, ProviderSubscriptionState } from "./provider-status";
import type { PlanGraceEmailProps } from "@/emails/plan-grace";
import type { GraceEmailKind, GraceReason, PlanGrace, PlanUsage } from "@/lib/billing/entitlements";
import type { Plan } from "@/lib/billing/plans";
import type { Subscription, User } from "@/server/db/schema";
import type { DbClient } from "@/server/lib/user-plan";

const log = logger.child({ component: "entitlements" });

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_BATCH_SIZE = 100; // Resend's batch limit
const LOOKUP_CHUNK = 1000;
// Local statuses the daily reconcile checks against Lemon Squeezy: still paid, or retrying a renewal.
const PROVIDER_CHECKED_STATUSES = ["active", "on_trial", ...FAILED_PAYMENT_STATUSES];
// A subscription that ended longer ago than this gets no lapse grace or emails
// when the reconcile finds it: the customer stopped paying long ago.
const STALE_LAPSE_MS = 30 * DAY_MS;

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  );

// ----------------------------------------------------------------------------
// Grace writes
// ----------------------------------------------------------------------------

/**
 * Which recorded grace a new one may replace: `none` only starts it when the
 * account has never had one (over-plan, from the reconcile); `passed` also
 * replaces one that has ended (a new lapse from the webhook); `over_plan` also
 * replaces any over-plan grace, running or not (a lapse the reconcile found),
 * but never a lapse grace, so a lapse gets one grace period.
 */
type GraceReplace = "none" | "passed" | "over_plan";

async function startUserGrace(
  dbClient: DbClient,
  userId: string,
  grace: { plan: Plan; endsAt: Date; reason: GraceReason },
  replace: GraceReplace,
  now: Date,
  emailStage: number = GRACE_EMAIL_STAGE.none,
): Promise<boolean> {
  const replaceable = {
    none: isNull(user.planGraceEndsAt),
    passed: or(isNull(user.planGraceEndsAt), lte(user.planGraceEndsAt, now)),
    over_plan: or(isNull(user.planGraceEndsAt), eq(user.planGraceReason, "over_plan")),
  }[replace];
  const [result] = await dbClient
    .update(user)
    .set({
      planGracePlan: grace.plan,
      planGraceEndsAt: grace.endsAt,
      planGraceReason: grace.reason,
      planGraceEmailStage: emailStage,
    })
    .where(and(eq(user.id, userId), replaceable));
  return result.affectedRows > 0;
}

const CLEARED_GRACE = {
  planGracePlan: null,
  planGraceEndsAt: null,
  planGraceReason: null,
  planGraceEmailStage: GRACE_EMAIL_STAGE.none,
};

/**
 * The lapse grace a failed renewal (past_due, or unpaid once retries are
 * exhausted) gets: the subscribed plan for 7 days from now. Null otherwise.
 */
function failedPaymentGrace(sub: Subscription | null, now: Date) {
  const plan = subscribedPlan(sub);
  if (!sub?.status || !FAILED_PAYMENT_STATUSES.includes(sub.status) || plan === "free") {
    return null;
  }
  return { plan, endsAt: new Date(now.getTime() + GRACE_PERIOD_MS), reason: "lapsed" as const };
}

/**
 * The grace an account using features above `plan` gets: the plan that covers
 * it, for 7 days. Only features held to graceUsagePlan count (see
 * overPlanGraceFeatures); creation caps never need one.
 */
export function overPlanGrace(usage: PlanUsage, plan: Plan, now: Date) {
  const over = overPlanGraceFeatures(usage, plan);
  if (over.length === 0) return null;
  return {
    plan: over.reduce<Plan>((acc, item) => higherPlan(acc, item.requiredPlan), "free"),
    endsAt: new Date(now.getTime() + GRACE_PERIOD_MS),
    reason: "over_plan" as const,
  };
}

/**
 * Checks an account the daily reconcile hasn't seen yet (for example right
 * after enforcement ships) on its first request, so an account already above
 * its plan gets its grace period before any restriction applies to it. Runs at
 * most once per account; returns the grace to use for this request. Called where
 * a request's plan is first resolved (workspace context, API key), with the root
 * client so it never runs inside a caller's transaction.
 */
export async function ensurePlanChecked(
  account: Pick<
    User,
    "id" | "planCheckedAt" | "planGraceEndsAt" | "planGracePlan" | "planGraceReason"
  >,
  sub: Subscription | null,
  now = new Date(),
): Promise<PlanGrace> {
  if (account.planCheckedAt || account.planGraceEndsAt) return account;

  // A failed renewal gets its lapse grace, as the reconcile would give it, not
  // an over-plan one. Otherwise usage is held to the base plan without any grace.
  const grace = isPausedSubscription(sub)
    ? null
    : (failedPaymentGrace(sub, now) ??
      overPlanGrace(
        (await getPlanUsageByUser(db, [account.id], now)).get(account.id) ?? EMPTY_USAGE,
        effectivePlan(sub, NO_GRACE, now),
        now,
      ));
  if (!grace) {
    await db.update(user).set({ planCheckedAt: now }).where(eq(user.id, account.id));
    return account;
  }

  const [result] = await db
    .update(user)
    .set({
      planGracePlan: grace.plan,
      planGraceEndsAt: grace.endsAt,
      planGraceReason: grace.reason,
      planGraceEmailStage: GRACE_EMAIL_STAGE.none,
      planCheckedAt: now,
    })
    .where(and(eq(user.id, account.id), isNull(user.planGraceEndsAt)));
  // Batched requests can all reach this point; only the one that recorded the
  // grace sends its email.
  if (result.affectedRows > 0) {
    log.info(
      { userId: account.id, plan: grace.plan, reason: grace.reason },
      "started grace on first check",
    );
    await runBackgroundTask(sendDueGraceEmails({ userIds: [account.id], now }));
  }
  return {
    planGracePlan: grace.plan,
    planGraceEndsAt: grace.endsAt,
    planGraceReason: grace.reason,
  };
}

/**
 * Clears running over-plan graces that no longer cover anything: the account
 * uses no feature held to graceUsagePlan above its paid plan any more (it was
 * removed, or only creation caps were ever over). Their notice and emails stop
 * with them. planCheckedAt stays set, so ensurePlanChecked doesn't start the
 * grace again. Lapse graces are left alone.
 */
export async function clearUnneededOverPlanGraces(now = new Date()): Promise<number> {
  const running = await db
    .select({ userId: user.id, sub: subscription })
    .from(user)
    .leftJoin(subscription, eq(subscription.userId, user.id))
    .where(and(eq(user.planGraceReason, "over_plan"), gt(user.planGraceEndsAt, now)));

  let cleared = 0;
  for (const rows of chunk(running, LOOKUP_CHUNK)) {
    const usage = await getPlanUsageByUser(
      db,
      rows.map((row) => row.userId),
      now,
    );
    const ids = rows
      .filter(
        (row) =>
          overPlanGraceFeatures(usage.get(row.userId) ?? EMPTY_USAGE, paidPlan(row.sub, now))
            .length === 0,
      )
      .map((row) => row.userId);
    if (ids.length === 0) continue;
    // Re-checked in the write, so a lapse grace recorded meanwhile is kept.
    const [result] = await db
      .update(user)
      .set(CLEARED_GRACE)
      .where(
        and(
          inArray(user.id, ids),
          eq(user.planGraceReason, "over_plan"),
          gt(user.planGraceEndsAt, now),
        ),
      );
    cleared += result.affectedRows;
  }
  if (cleared > 0) log.info({ cleared }, "cleared over-plan graces that no longer apply");
  return cleared;
}

/** Keeps the grace period of teams owned by `ownerId` in step with the owner's paid plan. */
async function syncOwnedTeams(dbClient: DbClient, ownerId: string, ownerPaid: Plan, now: Date) {
  if (ownerPaid === "ultra") {
    await dbClient
      .update(team)
      .set({ ownerPlanGraceEndsAt: null, ownerPlanGraceEmailStage: GRACE_EMAIL_STAGE.none })
      .where(and(eq(team.ownerId, ownerId), isNotNull(team.ownerPlanGraceEndsAt)));
    return;
  }
  await dbClient
    .update(team)
    .set({
      ownerPlanGraceEndsAt: new Date(now.getTime() + GRACE_PERIOD_MS),
      ownerPlanGraceEmailStage: GRACE_EMAIL_STAGE.none,
    })
    .where(
      and(eq(team.ownerId, ownerId), isNull(team.deletedAt), isNull(team.ownerPlanGraceEndsAt)),
    );
}

// ----------------------------------------------------------------------------
// Webhook
// ----------------------------------------------------------------------------

/**
 * Applies a subscription change to the account's entitlements: a lapse
 * (expiry, failed payment, refund-driven cancellation) starts a grace period at
 * the plan the account had; resubscribing clears it and restores everything at
 * once. `previous` is the subscription row before the event was applied. The
 * webhook runs this in the same transaction as an expiry, which resets the row
 * to free, so the lapse can't be lost after that write.
 */
export async function applyBillingEventEntitlements(
  dbClient: DbClient,
  userId: string,
  previous: Subscription | null,
  now = new Date(),
): Promise<void> {
  const record = await dbClient.query.user.findFirst({
    where: eq(user.id, userId),
    with: { subscriptions: true },
  });
  if (!record) return;

  const current = record.subscriptions ?? null;
  const before = planBeforeBillingEvent(previous, record, now);
  const change = graceChangeAfterBillingEvent({
    before: before.plan,
    lapsedAt: before.lapsedAt,
    subscription: current,
    grace: record,
    now,
  });

  if (change.type === "start") {
    await startUserGrace(dbClient, userId, { ...change, reason: "lapsed" }, "passed", now);
  } else if (change.type === "clear") {
    await dbClient.update(user).set(CLEARED_GRACE).where(eq(user.id, userId));
  }
  await syncOwnedTeams(dbClient, userId, paidPlan(current, now), now);
  log.info({ userId, change: change.type }, "synced entitlements after billing event");
}

/** applyBillingEventEntitlements, then the grace emails that are now due. */
export async function syncEntitlementsAfterBillingEvent(
  userId: string,
  previous: Subscription | null,
  now = new Date(),
): Promise<void> {
  await applyBillingEventEntitlements(db, userId, previous, now);
  await sendDueGraceEmails({ userIds: [userId], now });
}

// ----------------------------------------------------------------------------
// Provider status
// ----------------------------------------------------------------------------

/**
 * Records the lapse of a subscription that ended long ago (see STALE_LAPSE_MS)
 * as already run out, with its emails marked sent, and its owner's teams the
 * same, so the account is on Free at once and no step of the reconcile starts a
 * grace or emails it about a plan it stopped paying for long ago.
 */
async function recordStaleLapse(dbClient: DbClient, sub: Subscription, endedAt: Date, now: Date) {
  const graceEndsAt = new Date(endedAt.getTime() + GRACE_PERIOD_MS);
  const plan = subscribedPlan(sub);
  if (plan !== "free") {
    await startUserGrace(
      dbClient,
      sub.userId,
      { plan, endsAt: graceEndsAt, reason: "lapsed" },
      "over_plan",
      now,
      GRACE_EMAIL_STAGE.ended,
    );
  }
  await dbClient
    .update(team)
    .set({ ownerPlanGraceEndsAt: graceEndsAt, ownerPlanGraceEmailStage: GRACE_EMAIL_STAGE.ended })
    .where(
      and(eq(team.ownerId, sub.userId), isNull(team.deletedAt), isNull(team.ownerPlanGraceEndsAt)),
    );
}

/**
 * Mirrors a subscription that Lemon Squeezy has ended (see
 * providerEndedSubscription) onto the local row still holding it as paid or
 * retrying a renewal, for when that webhook was missed: the same writes as the
 * webhook, with the entitlement sync in the same transaction. One that ended
 * over 30 days ago gets no grace or emails (recordStaleLapse). Only a row still
 * in the status it was read with and older than the provider's state is
 * written. Returns whether the row changed.
 */
export async function syncEndedSubscription(
  sub: Subscription,
  provider: ProviderSubscriptionState,
  now = new Date(),
): Promise<boolean> {
  if (!sub.subscriptionId || !sub.status || !providerEndedSubscription(sub.status, provider, now)) {
    return false;
  }
  const changes =
    provider.status === "expired"
      ? {
          status: provider.status,
          plan: "free" as const,
          variantId: 0,
          productId: 0,
          endsAt: provider.endsAt ?? now,
        }
      : { status: provider.status, endsAt: provider.endsAt };
  return db.transaction(async (tx) => {
    const [result] = await tx
      .update(subscription)
      .set({ ...changes, ...(provider.updatedAt && { providerUpdatedAt: provider.updatedAt }) })
      .where(
        and(
          eq(subscription.id, sub.id),
          eq(subscription.subscriptionId, sub.subscriptionId ?? 0),
          eq(subscription.status, sub.status ?? ""),
          provider.updatedAt
            ? or(
                isNull(subscription.providerUpdatedAt),
                lt(subscription.providerUpdatedAt, provider.updatedAt),
              )
            : undefined,
        ),
      );
    if (result.affectedRows === 0) return false;
    const { endsAt } = provider;
    const stale = !!endsAt && endsAt.getTime() < now.getTime() - STALE_LAPSE_MS;
    if (stale && endsAt) {
      await recordStaleLapse(tx, sub, endsAt, now);
    } else {
      await applyBillingEventEntitlements(tx, sub.userId, sub, now);
    }
    log.info(
      {
        id: sub.id,
        userId: sub.userId,
        subscriptionId: sub.subscriptionId,
        from: sub.status,
        to: provider.status,
        endsAt,
        stale,
      },
      "synced subscription ended at provider",
    );
    return true;
  });
}

/**
 * Checks every subscription held locally as paid or in a failed payment
 * against Lemon Squeezy and syncs the ones it has ended, so accounts the
 * provider stopped billing lose their paid plan and failed payments stop asking
 * for a card update. A row the provider doesn't know, or that can't be checked,
 * is left unchanged (the latter for the next run). Returns how many rows changed.
 */
export async function syncProviderEndedSubscriptions(
  now = new Date(),
  lookup: ProviderSubscriptionLookup = lookupProviderSubscription,
): Promise<number> {
  const held = await db
    .select()
    .from(subscription)
    .where(
      and(
        inArray(subscription.status, PROVIDER_CHECKED_STATUSES),
        gt(subscription.subscriptionId, 0),
      ),
    );
  let synced = 0;
  // Sequential: one lookup per paying account a day stays well inside the provider's rate limit.
  for (const sub of held) {
    try {
      const provider = await lookup(sub.subscriptionId ?? 0);
      if (await syncEndedSubscription(sub, provider, now)) synced++;
    } catch (err) {
      const context = { id: sub.id, userId: sub.userId, subscriptionId: sub.subscriptionId };
      if (err instanceof ProviderSubscriptionNotFoundError) {
        log.warn(context, "subscription not found at provider; left unchanged");
      } else {
        log.warn({ err, ...context }, "could not check subscription with provider");
      }
    }
  }
  if (held.length > 0) log.info({ checked: held.length, synced }, "checked subscriptions");
  return synced;
}

type ProviderCheck = {
  lookup: ProviderSubscriptionLookup;
  sync: typeof syncEndedSubscription;
};

const PROVIDER_CHECK: ProviderCheck = {
  lookup: lookupProviderSubscription,
  sync: syncEndedSubscription,
};

/**
 * Whether an email asking for a card update may go out for this subscription.
 * The local row may have missed the webhook that ended it, and the
 * update-payment-method link can't revive an expired subscription, so Lemon
 * Squeezy is asked first. An ended subscription is synced and its email skipped
 * (the next run sends the one for its new state); one that can't be checked is
 * left for the next run.
 */
export async function paymentUpdateEmailAllowed(
  sub: Subscription,
  now: Date,
  check: ProviderCheck = PROVIDER_CHECK,
): Promise<boolean> {
  // Rows from before subscription ids were stored can't be checked.
  if (!sub.subscriptionId) return true;
  try {
    const provider = await check.lookup(sub.subscriptionId);
    if (!isEndedProviderStatus(provider.status)) return true;
    await check.sync(sub, provider, now);
    log.info(
      { userId: sub.userId, subscriptionId: sub.subscriptionId, status: provider.status },
      "skipped card-update email for subscription ended at provider",
    );
  } catch (err) {
    log.warn(
      { err, userId: sub.userId, subscriptionId: sub.subscriptionId },
      "could not confirm failed payment with provider; card-update email deferred",
    );
  }
  return false;
}

// ----------------------------------------------------------------------------
// Daily reconcile
// ----------------------------------------------------------------------------

export type ReconcileResult = {
  subscriptionsSynced: number;
  gracesCleared: number;
  lapsesStarted: number;
  overPlanCleared: number;
  overPlanStarted: number;
  teamGracesStarted: number;
  teamGracesCleared: number;
  emailsSent: number;
};

/**
 * Brings every account's grace state in line with its live subscription and
 * usage, so missed webhooks are caught and accounts already above their plan
 * (including every such account when this first ships) get the same notice
 * period. Idempotent: an account gets one grace period per lapse; an expired
 * one is kept so it is never extended.
 */
export async function reconcileEntitlements(now = new Date()): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    subscriptionsSynced: 0,
    gracesCleared: 0,
    lapsesStarted: 0,
    overPlanCleared: 0,
    overPlanStarted: 0,
    teamGracesStarted: 0,
    teamGracesCleared: 0,
    emailsSent: 0,
  };

  // 0. Paid or failed-payment subscriptions Lemon Squeezy has since ended
  //    (webhook missed), so the steps below and the emails see the real state.
  result.subscriptionsSynced = await syncProviderEndedSubscriptions(now);

  // 1. Grace periods the paid plan covers again (resubscribed; webhook missed).
  //    A passed lapse grace on a subscription that is paid again is cleared too.
  const gracedPayers = await db
    .select({
      userId: user.id,
      planGracePlan: user.planGracePlan,
      planGraceEndsAt: user.planGraceEndsAt,
      planGraceReason: user.planGraceReason,
      sub: subscription,
    })
    .from(user)
    .innerJoin(subscription, eq(subscription.userId, user.id))
    .where(
      and(
        isNotNull(user.planGraceEndsAt),
        inArray(subscription.status, ["active", "on_trial", "cancelled"]),
      ),
    );
  const toClear = gracedPayers
    .filter(
      (row) =>
        planAtLeast(paidPlan(row.sub, now), row.planGracePlan ?? "free") ||
        lapseEndedByPayment(row.sub, row, now),
    )
    .map((row) => row.userId);
  for (const ids of chunk(toClear, LOOKUP_CHUNK)) {
    await db.update(user).set(CLEARED_GRACE).where(inArray(user.id, ids));
  }
  result.gracesCleared = toClear.length;

  // 2. Lapses the webhook missed: a failed payment (past_due, or unpaid once
  //    retries are exhausted) with no lapse grace yet, or a cancelled
  //    subscription whose paid period ended in the last grace window. A passed
  //    over-plan grace doesn't cover the lapse, so it is replaced. On a failed
  //    payment a running over-plan grace within the subscribed plan is replaced
  //    too, by a fresh lapse grace from today with its emails reset, so the
  //    customer gets the "payment didn't go through" notice that asks for a
  //    card update instead of the upgrade one.
  const lapsed = await db
    .select({
      userId: user.id,
      planGraceEndsAt: user.planGraceEndsAt,
      planGraceReason: user.planGraceReason,
      planGracePlan: user.planGracePlan,
      sub: subscription,
    })
    .from(user)
    .innerJoin(subscription, eq(subscription.userId, user.id))
    .where(
      and(
        or(
          isNull(user.planGraceEndsAt),
          and(
            eq(user.planGraceReason, "over_plan"),
            or(
              lte(user.planGraceEndsAt, now),
              inArray(subscription.status, FAILED_PAYMENT_STATUSES),
            ),
          ),
        ),
        isNull(user.deletedAt),
        or(
          inArray(subscription.status, FAILED_PAYMENT_STATUSES),
          and(
            eq(subscription.status, "cancelled"),
            lte(subscription.endsAt, now),
            gt(subscription.endsAt, new Date(now.getTime() - GRACE_PERIOD_MS)),
          ),
        ),
      ),
    );
  for (const row of lapsed) {
    const failed = failedPaymentGrace(row.sub, now);
    if (failed) {
      // An over-plan grace above the subscribed plan keeps running: narrowing it
      // would cut those features off early, and once it passes it is replaced.
      if (
        row.planGraceReason === "over_plan" &&
        isGraceActive(row.planGraceEndsAt, now) &&
        !planAtLeast(failed.plan, row.planGracePlan ?? "free")
      ) {
        continue;
      }
      if (await startUserGrace(db, row.userId, failed, "over_plan", now)) {
        result.lapsesStarted++;
      }
      continue;
    }
    const plan = subscribedPlan(row.sub);
    if (plan === "free" || !row.sub.endsAt) continue;
    const endsAt = new Date(row.sub.endsAt.getTime() + GRACE_PERIOD_MS);
    if (
      await startUserGrace(db, row.userId, { plan, endsAt, reason: "lapsed" }, "over_plan", now)
    ) {
      result.lapsesStarted++;
    }
  }

  // 3. Running over-plan graces that no longer cover anything are cleared; then
  //    accounts using features above their plan with no grace recorded get one.
  result.overPlanCleared = await clearUnneededOverPlanGraces(now);
  const usage = await getPlanUsageByUser(db, undefined, now);
  for (const ids of chunk([...usage.keys()], LOOKUP_CHUNK)) {
    const accounts = await db.query.user.findMany({
      where: and(
        inArray(user.id, ids),
        isNull(user.planGraceEndsAt),
        isNull(user.deletedAt),
        or(isNull(user.banned), eq(user.banned, false)),
      ),
      columns: { id: true },
      with: { subscriptions: true },
    });
    for (const account of accounts) {
      if (isPausedSubscription(account.subscriptions)) continue;
      const grace = overPlanGrace(
        usage.get(account.id) ?? EMPTY_USAGE,
        paidPlan(account.subscriptions, now),
        now,
      );
      if (grace && (await startUserGrace(db, account.id, grace, "none", now))) {
        result.overPlanStarted++;
      }
    }
  }
  // Every account has now been checked once (see ensurePlanChecked).
  await db.update(user).set({ planCheckedAt: now }).where(isNull(user.planCheckedAt));

  // 4. Teams follow their owner's paid plan.
  const teams = await db
    .select({ id: team.id, graceEndsAt: team.ownerPlanGraceEndsAt, sub: subscription })
    .from(team)
    .leftJoin(subscription, eq(subscription.userId, team.ownerId))
    .where(isNull(team.deletedAt));
  const teamsToClear: number[] = [];
  const teamsToStart: number[] = [];
  for (const row of teams) {
    const ownerOnUltra = paidPlan(row.sub, now) === "ultra";
    if (ownerOnUltra && row.graceEndsAt) teamsToClear.push(row.id);
    if (!ownerOnUltra && !row.graceEndsAt) teamsToStart.push(row.id);
  }
  if (teamsToClear.length > 0) {
    await db
      .update(team)
      .set({ ownerPlanGraceEndsAt: null, ownerPlanGraceEmailStage: GRACE_EMAIL_STAGE.none })
      .where(inArray(team.id, teamsToClear));
  }
  if (teamsToStart.length > 0) {
    await db
      .update(team)
      .set({
        ownerPlanGraceEndsAt: new Date(now.getTime() + GRACE_PERIOD_MS),
        ownerPlanGraceEmailStage: GRACE_EMAIL_STAGE.none,
      })
      .where(and(inArray(team.id, teamsToStart), isNull(team.ownerPlanGraceEndsAt)));
  }
  result.teamGracesCleared = teamsToClear.length;
  result.teamGracesStarted = teamsToStart.length;

  result.emailsSent = await sendDueGraceEmails({ now });
  return result;
}

// ----------------------------------------------------------------------------
// Emails
// ----------------------------------------------------------------------------

type PendingEmail = {
  to: string;
  subject: string;
  props: PlanGraceEmailProps;
  /** Moves the row to this email's stage; false when another run already did. */
  claim: () => Promise<boolean>;
  /** Undoes the claim after a failed send, so the next run retries it. */
  release: () => Promise<void>;
};

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function timeLeft(endsAt: Date, now: Date): string {
  const days = Math.max(1, Math.round((endsAt.getTime() - now.getTime()) / DAY_MS));
  return days === 1 ? "24 hours" : `${days} days`;
}

// pricing-cards.tsx opens on the plan named in `?plan=`.
const upgradeUrl = (plan: Plan) =>
  plan === "free" ? getAppUrl("/dashboard/pricing") : emailLinkUrl(EMAIL_LINKS.planGrace[plan]);

/**
 * The team grace email to its owner. When the owner's Ultra payment failed it
 * links to the update-payment-method page instead of pricing.
 */
export function teamGraceEmail(options: {
  teamName: string;
  ownerSubscription: Subscription | null;
  endsAt: Date;
  kind: GraceEmailKind;
  now: Date;
}) {
  const { teamName, endsAt, kind, now } = options;
  const endsOn = formatDay(endsAt);
  const paymentFailed = teamGraceAction(options.ownerSubscription) === "update_payment";
  const props: PlanGraceEmailProps = {
    kind,
    reason: "team",
    planName: "Ultra",
    endsOn,
    timeLeft: timeLeft(endsAt, now),
    teamName,
    items: [],
    upgradeUrl: upgradeUrl("ultra"),
    updatePaymentUrl: paymentFailed ? getAppUrl(updatePaymentPath("email")) : undefined,
  };
  return { subject: planGraceSubject(props), props };
}

/** Free-plan limits listed when a lapsed account uses no feature above Free. */
function freePlanSummary(): string[] {
  const free = getPlanCaps("free");
  return [
    `${free.linksLimit?.toLocaleString()} new links a month`,
    `${free.analyticsRangeLimitDays}-day analytics window`,
    "No custom domains, password protection, scheduling or targeting rules",
  ];
}

/**
 * The grace email to an account. A failed payment links to the
 * update-payment-method page (fixed on the existing subscription) instead of
 * pricing (a new checkout). Null for an over-plan grace with nothing left to
 * list: the account no longer uses anything the grace covers.
 */
export function accountGraceEmail(options: {
  subscription: Subscription | null;
  usage: PlanUsage;
  gracePlan: Plan;
  reason: GraceReason;
  endsAt: Date;
  kind: GraceEmailKind;
  now: Date;
}) {
  const { subscription, gracePlan, reason, endsAt, kind, now } = options;
  const paid = paidPlan(subscription, now);
  const items = overPlanGraceFeatures(options.usage, paid).map((item) =>
    describeOverPlanFeature(item, PLAN_NAMES[paid]),
  );
  if (reason === "over_plan" && items.length === 0) return null;
  const planName = PLAN_NAMES[gracePlan];
  const endsOn = formatDay(endsAt);
  const paymentFailed = graceAction(reason, subscription, gracePlan) === "update_payment";
  const props: PlanGraceEmailProps = {
    kind,
    reason,
    planName,
    endsOn,
    timeLeft: timeLeft(endsAt, now),
    items: items.length > 0 || reason !== "lapsed" ? items : freePlanSummary(),
    upgradeUrl: upgradeUrl(gracePlan),
    updatePaymentUrl: paymentFailed ? getAppUrl(updatePaymentPath("email")) : undefined,
  };
  return { subject: planGraceSubject(props), props };
}

/**
 * Sends the grace emails that are due (see dueGraceEmail) and records each
 * stage once its batch is accepted. Scoped to `userIds` when given (webhook).
 */
export async function sendDueGraceEmails(options: {
  userIds?: string[];
  now?: Date;
}): Promise<number> {
  const now = options.now ?? new Date();
  const pending: PendingEmail[] = [];

  // Accounts. Graces that ended over two days ago have nothing left to send.
  const accounts = await db.query.user.findMany({
    where: and(
      isNotNull(user.planGraceEndsAt),
      gt(user.planGraceEndsAt, new Date(now.getTime() - 2 * DAY_MS)),
      lt(user.planGraceEmailStage, GRACE_EMAIL_STAGE.ended),
      isNull(user.deletedAt),
      options.userIds ? inArray(user.id, options.userIds) : undefined,
    ),
    with: { subscriptions: true },
  });
  const due = accounts.flatMap((account) => {
    const { email, planGraceEndsAt: endsAt, planGracePlan: gracePlan } = account;
    if (!email || !endsAt || !gracePlan || isPausedSubscription(account.subscriptions)) return [];
    const reason = account.planGraceReason ?? "lapsed";
    const kind = dueGraceEmail({ reason, endsAt, stage: account.planGraceEmailStage ?? 0, now });
    return kind ? [{ account, email, endsAt, gracePlan, reason, kind }] : [];
  });
  const usage = await getPlanUsageByUser(
    db,
    due.map(({ account }) => account.id),
    now,
  );

  for (const { account, email, endsAt, gracePlan, reason, kind } of due) {
    const stage = GRACE_EMAIL_STAGE[kind];
    const message = accountGraceEmail({
      subscription: account.subscriptions,
      usage: usage.get(account.id) ?? EMPTY_USAGE,
      gracePlan,
      reason,
      endsAt,
      kind,
      now,
    });
    // Cleared by the next clearUnneededOverPlanGraces run.
    if (!message) continue;
    if (
      message.props.updatePaymentUrl &&
      account.subscriptions &&
      !(await paymentUpdateEmailAllowed(account.subscriptions, now))
    ) {
      continue;
    }

    pending.push({
      to: email,
      subject: message.subject,
      props: message.props,
      claim: async () => {
        const [result] = await db
          .update(user)
          .set({ planGraceEmailStage: stage })
          .where(and(eq(user.id, account.id), lt(user.planGraceEmailStage, stage)));
        return result.affectedRows > 0;
      },
      release: async () => {
        await db
          .update(user)
          .set({ planGraceEmailStage: account.planGraceEmailStage ?? GRACE_EMAIL_STAGE.none })
          .where(and(eq(user.id, account.id), eq(user.planGraceEmailStage, stage)));
      },
    });
  }

  // Teams (reported to the owner): day 0 and 24 hours before the end.
  if (!options.userIds) {
    const teams = await db
      .select({
        id: team.id,
        name: team.name,
        endsAt: team.ownerPlanGraceEndsAt,
        stage: team.ownerPlanGraceEmailStage,
        ownerEmail: user.email,
        ownerSubscription: subscription,
      })
      .from(team)
      .innerJoin(user, eq(user.id, team.ownerId))
      .leftJoin(subscription, eq(subscription.userId, team.ownerId))
      .where(
        and(
          isNull(team.deletedAt),
          gt(team.ownerPlanGraceEndsAt, now),
          lt(team.ownerPlanGraceEmailStage, GRACE_EMAIL_STAGE.reminder),
        ),
      );
    for (const row of teams) {
      if (!row.ownerEmail || !row.endsAt || isPausedSubscription(row.ownerSubscription)) continue;
      const kind = dueGraceEmail({
        reason: "over_plan",
        endsAt: row.endsAt,
        stage: row.stage ?? 0,
        now,
      });
      if (!kind) continue;
      const stage = GRACE_EMAIL_STAGE[kind];
      const { subject, props } = teamGraceEmail({
        teamName: row.name,
        ownerSubscription: row.ownerSubscription,
        endsAt: row.endsAt,
        kind,
        now,
      });
      if (
        props.updatePaymentUrl &&
        row.ownerSubscription &&
        !(await paymentUpdateEmailAllowed(row.ownerSubscription, now))
      ) {
        continue;
      }
      pending.push({
        to: row.ownerEmail,
        subject,
        props,
        claim: async () => {
          const [result] = await db
            .update(team)
            .set({ ownerPlanGraceEmailStage: stage })
            .where(and(eq(team.id, row.id), lt(team.ownerPlanGraceEmailStage, stage)));
          return result.affectedRows > 0;
        },
        release: async () => {
          await db
            .update(team)
            .set({ ownerPlanGraceEmailStage: row.stage ?? GRACE_EMAIL_STAGE.none })
            .where(and(eq(team.id, row.id), eq(team.ownerPlanGraceEmailStage, stage)));
        },
      });
    }
  }

  if (pending.length === 0) return 0;
  const resend = await getResend();
  if (!resend) return 0;
  // Imported here, not at the top: the template pulls React into every route that imports this
  // module (API auth, workspace context), and only this path renders it.
  const { default: PlanGraceEmail } = await import("@/emails/plan-grace");

  // Claimed before sending, so concurrent runs (batched first requests, the
  // webhook and the cron) never send the same stage twice.
  const claimed: PendingEmail[] = [];
  for (const email of pending) {
    if (await email.claim()) claimed.push(email);
  }

  let sent = 0;
  for (const batch of chunk(claimed, EMAIL_BATCH_SIZE)) {
    let error: Error | null = null;
    try {
      const emails = await Promise.all(
        batch.map(async (email) =>
          withReplyTo({
            from: EMAIL_FROM_SYSTEM,
            to: email.to,
            subject: email.subject,
            ...(await renderEmail(PlanGraceEmail(email.props), email.to)),
          }),
        ),
      );
      ({ error } = await resend.batch.send(emails));
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
    }
    if (error) {
      log.error({ err: error, size: batch.length }, "failed to send grace emails");
      await Promise.all(batch.map((email) => email.release()));
      continue;
    }
    sent += batch.length;
  }
  return sent;
}

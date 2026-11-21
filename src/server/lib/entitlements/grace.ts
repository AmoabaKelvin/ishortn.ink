import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";

import PlanGraceEmail from "@/emails/plan-grace";
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
  lapseEndedByPayment,
  NO_GRACE,
  overPlanFeatures,
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
import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { db } from "@/server/db";
import { subscription, team, user } from "@/server/db/schema";
import { resend } from "@/server/lib/notifications/resend-client";
import { EMAIL_FROM } from "@/server/lib/notifications/send-email";

import { getPlanUsageByUser } from "./usage";

import type { PlanGraceEmailProps } from "@/emails/plan-grace";
import type { GraceEmailKind, GraceReason, PlanGrace, PlanUsage } from "@/lib/billing/entitlements";
import type { Plan } from "@/lib/billing/plans";
import type { Subscription, User } from "@/server/db/schema";
import type { DbClient } from "@/server/lib/user-plan";

const log = logger.child({ component: "entitlements" });

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_BATCH_SIZE = 100; // Resend's batch limit
const LOOKUP_CHUNK = 1000;
// Lemon Squeezy statuses for a renewal that failed: retrying, then retries exhausted.
const FAILED_PAYMENT_STATUSES = ["past_due", "unpaid"];

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  );

// ----------------------------------------------------------------------------
// Grace writes
// ----------------------------------------------------------------------------

/**
 * Starts an account grace period. `ifNone` only starts it when the account has
 * never had one recorded (the reconcile); otherwise it also replaces one that
 * has already passed (a new lapse from the webhook).
 */
async function startUserGrace(
  dbClient: DbClient,
  userId: string,
  grace: { plan: Plan; endsAt: Date; reason: GraceReason },
  ifNone: boolean,
  now: Date,
): Promise<boolean> {
  const [result] = await dbClient
    .update(user)
    .set({
      planGracePlan: grace.plan,
      planGraceEndsAt: grace.endsAt,
      planGraceReason: grace.reason,
      planGraceEmailStage: GRACE_EMAIL_STAGE.none,
    })
    .where(
      and(
        eq(user.id, userId),
        ifNone
          ? isNull(user.planGraceEndsAt)
          : or(isNull(user.planGraceEndsAt), lte(user.planGraceEndsAt, now)),
      ),
    );
  return result.affectedRows > 0;
}

const CLEARED_GRACE = {
  planGracePlan: null,
  planGraceEndsAt: null,
  planGraceReason: null,
  planGraceEmailStage: GRACE_EMAIL_STAGE.none,
};

/** The grace an account using features above `plan` gets: the plan that covers it, for 7 days. */
function overPlanGrace(usage: PlanUsage, plan: Plan, now: Date) {
  const over = overPlanFeatures(usage, plan);
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

  const usage = await getPlanUsageByUser(db, [account.id], now);
  // Base plan without any grace: a failed renewal is still covered until its
  // lapse grace is recorded, so it isn't treated as over its plan here.
  const grace = overPlanGrace(
    usage.get(account.id) ?? EMPTY_USAGE,
    effectivePlan(sub, NO_GRACE, now),
    now,
  );
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
    log.info({ userId: account.id, plan: grace.plan }, "started over-plan grace on first check");
    await runBackgroundTask(sendDueGraceEmails({ userIds: [account.id], now }));
  }
  return {
    planGracePlan: grace.plan,
    planGraceEndsAt: grace.endsAt,
    planGraceReason: grace.reason,
  };
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
    await startUserGrace(dbClient, userId, { ...change, reason: "lapsed" }, false, now);
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
// Daily reconcile
// ----------------------------------------------------------------------------

export type ReconcileResult = {
  gracesCleared: number;
  lapsesStarted: number;
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
    gracesCleared: 0,
    lapsesStarted: 0,
    overPlanStarted: 0,
    teamGracesStarted: 0,
    teamGracesCleared: 0,
    emailsSent: 0,
  };

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
  //    over-plan grace doesn't cover the lapse, so it is replaced; a running one
  //    on a failed payment becomes the lapse grace (same dates, emails sent so
  //    far kept), so the notice asks for a card update instead of an upgrade.
  const lapsed = await db
    .select({
      userId: user.id,
      planGraceEndsAt: user.planGraceEndsAt,
      planGraceReason: user.planGraceReason,
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
    const plan = subscribedPlan(row.sub);
    if (plan === "free") continue;
    if (row.planGraceReason === "over_plan" && isGraceActive(row.planGraceEndsAt, now)) {
      const [converted] = await db
        .update(user)
        .set({ planGracePlan: plan, planGraceReason: "lapsed" })
        .where(
          and(
            eq(user.id, row.userId),
            eq(user.planGraceReason, "over_plan"),
            gt(user.planGraceEndsAt, now),
          ),
        );
      if (converted.affectedRows > 0) result.lapsesStarted++;
      continue;
    }
    const from = row.sub.status === "cancelled" && row.sub.endsAt ? row.sub.endsAt : now;
    const endsAt = new Date(from.getTime() + GRACE_PERIOD_MS);
    if (await startUserGrace(db, row.userId, { plan, endsAt, reason: "lapsed" }, false, now)) {
      result.lapsesStarted++;
    }
  }

  // 3. Accounts using features above their plan with no grace recorded.
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
      const grace = overPlanGrace(
        usage.get(account.id) ?? EMPTY_USAGE,
        paidPlan(account.subscriptions, now),
        now,
      );
      if (grace && (await startUserGrace(db, account.id, grace, true, now))) {
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
  react: ReturnType<typeof PlanGraceEmail>;
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
const upgradeUrl = (plan: Plan) => getAppUrl(`/dashboard/pricing?plan=${plan}`);

function accountSubject(
  kind: GraceEmailKind,
  reason: GraceReason,
  planName: string,
  endsOn: string,
  paymentFailed: boolean,
) {
  if (kind === "ended") return "Your iShortn account is on the Free plan now";
  if (paymentFailed && kind === "started") {
    return `Your iShortn ${planName} payment didn't go through`;
  }
  if (reason === "lapsed") {
    return kind === "started"
      ? `Your iShortn ${planName} access continues until ${endsOn}`
      : `Your iShortn ${planName} access ends on ${endsOn}`;
  }
  return kind === "started"
    ? `Some of your iShortn features need ${planName} after ${endsOn}`
    : `Reminder: some of your iShortn features need ${planName} from ${endsOn}`;
}

/**
 * The team grace email to its owner. When the owner's Ultra payment failed it
 * links to the update-payment-method page instead of pricing.
 */
export function teamGraceEmail(options: {
  teamName: string;
  ownerName: string | null;
  ownerSubscription: Subscription | null;
  endsAt: Date;
  kind: GraceEmailKind;
  now: Date;
}) {
  const { teamName, endsAt, kind, now } = options;
  const endsOn = formatDay(endsAt);
  const paymentFailed = teamGraceAction(options.ownerSubscription) === "update_payment";
  let subject: string;
  if (kind !== "started") subject = `${teamName} becomes read-only on ${endsOn}`;
  else if (paymentFailed) subject = "Your iShortn Ultra payment didn't go through";
  else subject = `${teamName} needs Ultra to stay editable after ${endsOn}`;
  return {
    subject,
    props: {
      recipientName: options.ownerName,
      kind,
      reason: "team",
      planName: "Ultra",
      endsOn,
      timeLeft: timeLeft(endsAt, now),
      teamName,
      items: [],
      upgradeUrl: upgradeUrl("ultra"),
      updatePaymentUrl: paymentFailed ? getAppUrl(updatePaymentPath("email")) : undefined,
    } satisfies PlanGraceEmailProps,
  };
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
    if (!email || !endsAt || !gracePlan) return [];
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
    const paid = paidPlan(account.subscriptions, now);
    const over = overPlanFeatures(usage.get(account.id) ?? EMPTY_USAGE, paid);
    const items = over.map((item) => describeOverPlanFeature(item, PLAN_NAMES[paid]));
    const planName = PLAN_NAMES[gracePlan];
    const endsOn = formatDay(endsAt);
    const stage = GRACE_EMAIL_STAGE[kind];
    // A failed payment is fixed on the existing subscription, not with a new checkout.
    const paymentFailed = graceAction(reason, account.subscriptions?.status) === "update_payment";

    pending.push({
      to: email,
      subject: accountSubject(kind, reason, planName, endsOn, paymentFailed),
      react: PlanGraceEmail({
        recipientName: account.name,
        kind,
        reason,
        planName,
        endsOn,
        timeLeft: timeLeft(endsAt, now),
        items: items.length > 0 || reason !== "lapsed" ? items : freePlanSummary(),
        upgradeUrl: upgradeUrl(gracePlan),
        updatePaymentUrl: paymentFailed ? getAppUrl(updatePaymentPath("email")) : undefined,
      }),
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
        ownerName: user.name,
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
      if (!row.ownerEmail || !row.endsAt) continue;
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
        ownerName: row.ownerName,
        ownerSubscription: row.ownerSubscription,
        endsAt: row.endsAt,
        kind,
        now,
      });
      pending.push({
        to: row.ownerEmail,
        subject,
        react: PlanGraceEmail(props),
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

  if (!resend || pending.length === 0) return 0;

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
      ({ error } = await resend.batch.send(
        batch.map((email) => ({
          from: EMAIL_FROM,
          to: email.to,
          subject: email.subject,
          react: email.react,
        })),
      ));
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

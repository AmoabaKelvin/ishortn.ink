import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";

import PlanGraceEmail from "@/emails/plan-grace";
import { env } from "@/env.mjs";
import {
  describeOverPlanFeature,
  dueGraceEmail,
  effectivePlan,
  EMPTY_USAGE,
  GRACE_EMAIL_STAGE,
  GRACE_PERIOD_MS,
  graceChangeAfterBillingEvent,
  higherPlan,
  overPlanFeatures,
  paidPlan,
  PLAN_NAMES,
  planAtLeast,
  subscribedPlan,
} from "@/lib/billing/entitlements";
import { getPlanCaps } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { subscription, team, user } from "@/server/db/schema";
import { resend } from "@/server/lib/notifications/resend-client";

import { getPlanUsageByUser } from "./usage";

import type { GraceEmailKind, GraceReason } from "@/lib/billing/entitlements";
import type { Plan } from "@/lib/billing/plans";
import type { Subscription } from "@/server/db/schema";
import type { DbClient } from "@/server/lib/user-plan";

const log = logger.child({ component: "entitlements" });

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_BATCH_SIZE = 100; // Resend's batch limit
const LOOKUP_CHUNK = 1000;

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
 * once. `previous` is the subscription row before the event was applied.
 */
export async function syncEntitlementsAfterBillingEvent(
  userId: string,
  previous: Subscription | null,
  now = new Date(),
): Promise<void> {
  const record = await db.query.user.findFirst({
    where: eq(user.id, userId),
    with: { subscriptions: true },
  });
  if (!record) return;

  const current = record.subscriptions ?? null;
  const change = graceChangeAfterBillingEvent({
    before: effectivePlan(previous, record, now),
    subscription: current,
    grace: record,
    now,
  });

  if (change.type === "start") {
    await startUserGrace(db, userId, { ...change, reason: "lapsed" }, false, now);
  } else if (change.type === "clear") {
    await db.update(user).set(CLEARED_GRACE).where(eq(user.id, userId));
  }
  await syncOwnedTeams(db, userId, paidPlan(current, now), now);

  log.info({ userId, change: change.type }, "synced entitlements after billing event");
  if (change.type === "start") await sendDueGraceEmails({ userIds: [userId], now });
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
  const gracedPayers = await db
    .select({ userId: user.id, gracePlan: user.planGracePlan, sub: subscription })
    .from(user)
    .innerJoin(subscription, eq(subscription.userId, user.id))
    .where(
      and(
        isNotNull(user.planGraceEndsAt),
        inArray(subscription.status, ["active", "on_trial", "cancelled"]),
      ),
    );
  const toClear = gracedPayers
    .filter((row) => planAtLeast(paidPlan(row.sub, now), row.gracePlan ?? "free"))
    .map((row) => row.userId);
  for (const ids of chunk(toClear, LOOKUP_CHUNK)) {
    await db.update(user).set(CLEARED_GRACE).where(inArray(user.id, ids));
  }
  result.gracesCleared = toClear.length;

  // 2. Lapses the webhook missed: a failed payment with no grace yet, or a
  //    cancelled subscription whose paid period ended in the last grace window.
  const lapsed = await db
    .select({ userId: user.id, sub: subscription })
    .from(user)
    .innerJoin(subscription, eq(subscription.userId, user.id))
    .where(
      and(
        isNull(user.planGraceEndsAt),
        isNull(user.deletedAt),
        or(
          eq(subscription.status, "past_due"),
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
    const from = row.sub.status === "cancelled" && row.sub.endsAt ? row.sub.endsAt : now;
    const endsAt = new Date(from.getTime() + GRACE_PERIOD_MS);
    if (await startUserGrace(db, row.userId, { plan, endsAt, reason: "lapsed" }, true, now)) {
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
      const over = overPlanFeatures(
        usage.get(account.id) ?? EMPTY_USAGE,
        paidPlan(account.subscriptions, now),
      );
      if (over.length === 0) continue;
      const plan = over.reduce<Plan>((acc, item) => higherPlan(acc, item.requiredPlan), "free");
      const endsAt = new Date(now.getTime() + GRACE_PERIOD_MS);
      if (await startUserGrace(db, account.id, { plan, endsAt, reason: "over_plan" }, true, now)) {
        result.overPlanStarted++;
      }
    }
  }

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
  markSent: () => Promise<void>;
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

const upgradeUrl = () => `${env.NEXT_PUBLIC_APP_URL}/dashboard/pricing`;

function accountSubject(
  kind: GraceEmailKind,
  reason: GraceReason,
  planName: string,
  endsOn: string,
) {
  if (kind === "ended") return "Your iShortn account is on the Free plan now";
  if (reason === "lapsed") {
    return kind === "started"
      ? `Your iShortn ${planName} access continues until ${endsOn}`
      : `Your iShortn ${planName} access ends on ${endsOn}`;
  }
  return kind === "started"
    ? `Some of your iShortn features need ${planName} after ${endsOn}`
    : `Reminder: some of your iShortn features need ${planName} from ${endsOn}`;
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

    pending.push({
      to: email,
      subject: accountSubject(kind, reason, planName, endsOn),
      react: PlanGraceEmail({
        recipientName: account.name,
        kind,
        reason,
        planName,
        endsOn,
        timeLeft: timeLeft(endsAt, now),
        items: items.length > 0 || reason !== "lapsed" ? items : freePlanSummary(),
        upgradeUrl: upgradeUrl(),
      }),
      markSent: async () => {
        await db
          .update(user)
          .set({ planGraceEmailStage: stage })
          .where(and(eq(user.id, account.id), lt(user.planGraceEmailStage, stage)));
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
      })
      .from(team)
      .innerJoin(user, eq(user.id, team.ownerId))
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
      const endsOn = formatDay(row.endsAt);
      const stage = GRACE_EMAIL_STAGE[kind];
      pending.push({
        to: row.ownerEmail,
        subject:
          kind === "started"
            ? `${row.name} needs Ultra to stay editable after ${endsOn}`
            : `${row.name} becomes read-only on ${endsOn}`,
        react: PlanGraceEmail({
          recipientName: row.ownerName,
          kind,
          reason: "team",
          planName: "Ultra",
          endsOn,
          timeLeft: timeLeft(row.endsAt, now),
          teamName: row.name,
          items: [],
          upgradeUrl: upgradeUrl(),
        }),
        markSent: async () => {
          await db
            .update(team)
            .set({ ownerPlanGraceEmailStage: stage })
            .where(and(eq(team.id, row.id), lt(team.ownerPlanGraceEmailStage, stage)));
        },
      });
    }
  }

  if (!resend || pending.length === 0) return 0;

  let sent = 0;
  for (const batch of chunk(pending, EMAIL_BATCH_SIZE)) {
    const { error } = await resend.batch.send(
      batch.map((email) => ({
        from: "Kelvin from iShortn <kelvin@ishortn.ink>",
        to: email.to,
        subject: email.subject,
        react: email.react,
      })),
    );
    if (error) {
      // Stages stay unsent, so the next run retries this batch.
      log.error({ err: error, size: batch.length }, "failed to send grace emails");
      continue;
    }
    await Promise.all(batch.map((email) => email.markSent()));
    sent += batch.length;
  }
  return sent;
}

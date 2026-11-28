import { and, asc, eq, gt, gte, isNull, ne, or } from "drizzle-orm";

import { effectivePlan } from "@/lib/billing/entitlements";
import { getSubscriptionMode, PLAN_CAPS } from "@/lib/billing/plans";
import { getActivePromo } from "@/lib/billing/promo";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { subscription, user } from "@/server/db/schema";

import { nextEventCountReset } from "./event-usage";
import {
  sendPromoPausedNotice,
  type SendPromoPausedNoticeInput,
} from "./notifications/promo-paused-notice";
import { isSuppressedSql } from "./notifications/suppression";

import type { Plan, SubscriptionMode } from "@/lib/billing/plans";
import type { Promo } from "@/lib/billing/promo";

const log = logger.child({ component: "promo-paused-notice" });

const PROMO_NOTICE_MAX_SENDS = 40;
const BATCH_SIZE = 100;

// mysql2 returns `exists (...)` as 0 or 1.
const isTrue = (value: number | string) => Number(value) === 1;

// Event counters reset at the start of the month in UTC (the Workers clock).
const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export type PromoNoticeCandidate = {
  email: string | null;
  plan: Plan;
  subscriptionMode: SubscriptionMode;
  banned: boolean | null;
  restrictedAt: Date | null;
  deletedAt: Date | null;
  productEmailsEnabled: boolean;
  /** The address has an active hard bounce or complaint. */
  emailSuppressed: boolean;
  droppedEventCount: number | null;
  eventTrackingPausedAt: Date | null;
  promoNoticeSentFor: string | null;
};

/**
 * Whether an account is due the one paused-tracking notice for `promo`: a Free account whose
 * upgrade is a new checkout, paused this month with visits dropped, that can be emailed and
 * hasn't had the notice for this promo.
 */
export function isPromoNoticeDue(candidate: PromoNoticeCandidate, promo: Promo, now: Date) {
  return (
    !!candidate.email &&
    candidate.plan === "free" &&
    candidate.subscriptionMode === "checkout" &&
    (candidate.droppedEventCount ?? 0) > 0 &&
    !!candidate.eventTrackingPausedAt &&
    candidate.eventTrackingPausedAt >= monthStart(now) &&
    candidate.promoNoticeSentFor !== promo.code &&
    !candidate.banned &&
    !candidate.restrictedAt &&
    !candidate.deletedAt &&
    candidate.productEmailsEnabled &&
    !candidate.emailSuppressed
  );
}

/**
 * The plan the notice offers. Pro's allowance covers the month unless the Free cap plus what was
 * dropped already exceeds it, in which case Ultra (no cap) is the plan that would have kept up.
 */
export function promoNoticeTarget(dropped: number): "pro" | "ultra" {
  const freeLimit = PLAN_CAPS.free.eventsLimit ?? 0;
  const proLimit = PLAN_CAPS.pro.eventsLimit ?? Number.POSITIVE_INFINITY;
  return freeLimit + dropped > proLimit ? "ultra" : "pro";
}

type SendNotice = (input: SendPromoPausedNoticeInput) => Promise<boolean>;

/**
 * While a promo runs, emails each paused Free account one notice for it, up to 40 per run. Each
 * account is claimed (`promoNoticeSentFor` set to the code) before its email goes out, so
 * overlapping runs can't both send; the claim is reverted only when the send is rejected, so the
 * next run retries it. Accounts that pause later in the window are picked up by later runs.
 */
export async function sendPromoPausedNotices({
  now = new Date(),
  send = sendPromoPausedNotice,
  maxSends = PROMO_NOTICE_MAX_SENDS,
}: { now?: Date; send?: SendNotice; maxSends?: number } = {}) {
  const counts = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  const promo = getActivePromo(now);
  if (!promo) return counts;

  const resetsAt = nextEventCountReset(now);
  const notSentForPromo = or(
    isNull(user.promoNoticeSentFor),
    ne(user.promoNoticeSentFor, promo.code),
  );
  let cursor = "";

  while (counts.sent < maxSends) {
    // The pause index bounds the scan to accounts paused this month; the rest of the rules are
    // applied by isPromoNoticeDue so they live in one place.
    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        banned: user.banned,
        restrictedAt: user.restrictedAt,
        deletedAt: user.deletedAt,
        productEmailsEnabled: user.productEmailsEnabled,
        droppedEventCount: user.droppedEventCount,
        eventTrackingPausedAt: user.eventTrackingPausedAt,
        promoNoticeSentFor: user.promoNoticeSentFor,
        planGracePlan: user.planGracePlan,
        planGraceEndsAt: user.planGraceEndsAt,
        planGraceReason: user.planGraceReason,
        subscription,
        emailSuppressed: isSuppressedSql(user.email).mapWith(isTrue),
      })
      .from(user)
      .leftJoin(subscription, eq(subscription.userId, user.id))
      .where(
        and(
          gt(user.id, cursor),
          gte(user.eventTrackingPausedAt, monthStart(now)),
          gt(user.droppedEventCount, 0),
          notSentForPromo,
        ),
      )
      .orderBy(asc(user.id))
      .limit(BATCH_SIZE);
    if (!rows.length) break;
    cursor = rows[rows.length - 1]!.id;

    for (const row of rows) {
      if (counts.sent >= maxSends) break;
      counts.checked++;
      const candidate = {
        ...row,
        plan: effectivePlan(row.subscription, row, now),
        subscriptionMode: getSubscriptionMode(row.subscription),
      };
      if (!row.email || !row.eventTrackingPausedAt || !isPromoNoticeDue(candidate, promo, now)) {
        counts.skipped++;
        continue;
      }

      const [claim] = await db
        .update(user)
        .set({ promoNoticeSentFor: promo.code })
        .where(and(eq(user.id, row.id), notSentForPromo));
      if (claim.affectedRows !== 1) {
        counts.skipped++;
        continue;
      }

      const dropped = row.droppedEventCount ?? 0;
      const accepted = await send({
        userId: row.id,
        email: row.email,
        dropped,
        pausedAt: row.eventTrackingPausedAt,
        resetsAt,
        target: promoNoticeTarget(dropped),
        promo,
      });
      if (accepted) {
        counts.sent++;
      } else {
        counts.failed++;
        await db
          .update(user)
          .set({ promoNoticeSentFor: row.promoNoticeSentFor })
          .where(and(eq(user.id, row.id), eq(user.promoNoticeSentFor, promo.code)));
      }
    }

    if (rows.length < BATCH_SIZE) break;
  }

  log.info({ ...counts, promo: promo.code }, "promo paused notices processed");
  return counts;
}

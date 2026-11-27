import { and, asc, count, eq, gt, gte, inArray, isNull, lte, max, min } from "drizzle-orm";

import { PLAN_CAPS, resolvePlan } from "@/lib/billing/plans";
import { formatDayMonth } from "@/lib/billing/promo";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import {
  link,
  linkVisit,
  planLimitHit,
  subscription,
  user,
  weeklySummaryEmail,
} from "@/server/db/schema";

import { isSuppressedSql } from "./notifications/suppression";
import {
  sendUpgradeNudgeEmail,
  upgradeNudgeEmailProps,
  type SendUpgradeNudgeInput,
} from "./notifications/upgrade-nudge";

import type {
  UpgradeNudgeAngle,
  UpgradeNudgeEmailProps,
  UpgradeNudgeReason,
} from "@/emails/upgrade-nudge";
import type { PlanLimitKey, PlanLimitViewKey } from "@/lib/billing/plan-limits";
import type { Plan } from "@/lib/billing/plans";

const log = logger.child({ component: "upgrade-nudge" });

const DAY_MS = 24 * 60 * 60 * 1000;
export const UPGRADE_NUDGE_MIN_AGE_MS = 4 * DAY_MS;
export const UPGRADE_NUDGE_MAX_AGE_MS = 10 * DAY_MS;
export const UPGRADE_NUDGE_MIN_LINKS = 3;
export const UPGRADE_NUDGE_MIN_CLICKS = 25;
/** Monthly events before the `events` angle is considered. */
export const UPGRADE_NUDGE_MIN_EVENTS = 300;
/** No upgrade nudge within this long of a weekly summary, so no one gets two in a day. */
export const UPGRADE_NUDGE_SUMMARY_GAP_MS = DAY_MS;
const UPGRADE_NUDGE_MAX_SENDS = 100;
const BATCH_SIZE = 100;

// mysql2 returns `exists (...)` as 0 or 1.
const isTrue = (value: number | string) => Number(value) === 1;

// Monthly counters reset at the start of the month in UTC (the Workers clock).
const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const nextMonthStart = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

export type UpgradeNudgeCandidate = {
  createdAt: Date | null;
  email: string | null;
  plan: Plan;
  banned: boolean | null;
  restrictedAt: Date | null;
  deletedAt: Date | null;
  productEmailsEnabled: boolean;
  /** The address has an active hard bounce or complaint. */
  emailSuppressed: boolean;
  eventTrackingPausedAt: Date | null;
  upgradeNudgeSentAt: Date | null;
  /** When the latest weekly summary for the account was claimed, if any. */
  lastWeeklySummaryAt: Date | null;
  /** Links the account created, in any workspace. */
  linkCount: number;
  /** Recorded clicks on those links. */
  clickCount: number;
  /** Plan limits the account hit while on Free. */
  freeLimitHitCount: number;
};

/**
 * Whether an account is due its one upgrade nudge at `now`: a Free account 4 to 10 days old that
 * can be emailed, hasn't had the nudge or a weekly summary in the last day, isn't already hearing
 * about paused tracking, and shows intent (3+ links, 25+ clicks or a Free plan limit hit).
 */
export function isUpgradeNudgeDue(candidate: UpgradeNudgeCandidate, now: Date): boolean {
  if (!candidate.createdAt || !candidate.email) return false;
  const age = now.getTime() - candidate.createdAt.getTime();
  if (age < UPGRADE_NUDGE_MIN_AGE_MS || age > UPGRADE_NUDGE_MAX_AGE_MS) return false;
  if (
    candidate.lastWeeklySummaryAt &&
    now.getTime() - candidate.lastWeeklySummaryAt.getTime() < UPGRADE_NUDGE_SUMMARY_GAP_MS
  ) {
    return false;
  }
  const hasIntent =
    candidate.linkCount >= UPGRADE_NUDGE_MIN_LINKS ||
    candidate.clickCount >= UPGRADE_NUDGE_MIN_CLICKS ||
    candidate.freeLimitHitCount > 0;
  return (
    hasIntent &&
    candidate.plan === "free" &&
    !candidate.upgradeNudgeSentAt &&
    !candidate.eventTrackingPausedAt &&
    !candidate.banned &&
    !candidate.restrictedAt &&
    !candidate.deletedAt &&
    candidate.productEmailsEnabled &&
    !candidate.emailSuppressed
  );
}

/** Pro features behind each PlanLimitHit key; other keys don't lead an email. */
const LIMIT_HIT_FEATURES = new Map(
  Object.entries({
    custom_domains: "custom domains",
    domains_page_view: "custom domains",
    folders: "folders",
    folders_page_view: "folders",
    analytics_range_view: "longer analytics ranges",
    api_keys: "API access",
    api_v1: "API access",
    tokens_page_view: "API access",
    webhooks: "webhooks",
    webhooks_page_view: "webhooks",
    geo_rules: "geo and device targeting",
    milestones: "click milestone alerts",
    monthly_links: "more links per month",
    qr_codes: "more QR codes",
    bio_pages: "more bio pages",
    campaigns: "more campaigns",
  } satisfies Partial<Record<PlanLimitKey | PlanLimitViewKey, string>>),
);

export type UpgradeNudgeUsage = {
  createdAt: Date;
  monthlyEventCount: number | null;
  lastEventCountReset: Date | null;
  monthlyLinkCount: number | null;
  lastLinkCountReset: Date | null;
  firstClickAt: Date | null;
  /** The account's Free plan limit hits, in any order. */
  limitHits: Array<{ limitKey: string; createdAt: Date }>;
};

// The counters reset lazily on the next event or link, so one last reset before this month is
// last month's count.
const currentMonthCount = (
  count: number | null,
  lastReset: Date | null,
  createdAt: Date,
  now: Date,
) => ((lastReset ?? createdAt) < monthStart(now) ? 0 : (count ?? 0));

/**
 * When the month's events reach the Free cap at the pace since the later of sign-up and the
 * start of the month, or null when they won't before the monthly reset.
 */
export function projectedEventCapDate(
  monthlyEventCount: number,
  createdAt: Date,
  now: Date,
): Date | null {
  const limit = PLAN_CAPS.free.eventsLimit;
  if (limit === undefined || monthlyEventCount <= 0) return null;
  const start = Math.max(createdAt.getTime(), monthStart(now).getTime());
  const pace = monthlyEventCount / Math.max(1, (now.getTime() - start) / DAY_MS);
  const projected = new Date(Math.max(now.getTime(), start + (limit / pace) * DAY_MS));
  return projected < nextMonthStart(now) ? projected : null;
}

/** The first angle that applies: a Pro feature they tried, events, links, analytics, domain. */
export function chooseUpgradeNudgeAngle(usage: UpgradeNudgeUsage, now: Date): UpgradeNudgeAngle {
  const [hit] = usage.limitHits
    .flatMap((item) => {
      const feature = LIMIT_HIT_FEATURES.get(item.limitKey);
      return feature ? [{ feature, createdAt: item.createdAt }] : [];
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (hit) {
    return { reason: "limit_hit", feature: hit.feature, hitDate: formatDayMonth(hit.createdAt) };
  }

  const resetDate = formatDayMonth(nextMonthStart(now));
  const events = currentMonthCount(
    usage.monthlyEventCount,
    usage.lastEventCountReset,
    usage.createdAt,
    now,
  );
  const projected =
    events >= UPGRADE_NUDGE_MIN_EVENTS ? projectedEventCapDate(events, usage.createdAt, now) : null;
  if (projected) {
    return {
      reason: "events",
      monthlyEventCount: events,
      projectedDate: formatDayMonth(projected),
      resetDate,
    };
  }

  const links = currentMonthCount(
    usage.monthlyLinkCount,
    usage.lastLinkCountReset,
    usage.createdAt,
    now,
  );
  if (links >= (PLAN_CAPS.free.linksLimit ?? Number.POSITIVE_INFINITY) / 2) {
    return { reason: "links", monthlyLinkCount: links, resetDate };
  }

  if (usage.firstClickAt) {
    const windowMs = (PLAN_CAPS.free.analyticsRangeLimitDays ?? 0) * DAY_MS;
    const firstDay = new Date(
      Date.UTC(
        usage.firstClickAt.getUTCFullYear(),
        usage.firstClickAt.getUTCMonth(),
        usage.firstClickAt.getUTCDate(),
      ),
    );
    return {
      reason: "analytics",
      firstClickDate: formatDayMonth(firstDay),
      viewEndDate: formatDayMonth(new Date(firstDay.getTime() + windowMs)),
      ended: usage.firstClickAt.getTime() + windowMs <= now.getTime(),
      viewStartDate: formatDayMonth(new Date(now.getTime() - windowMs)),
    };
  }

  return { reason: "domain" };
}

type SendNudge = (input: SendUpgradeNudgeInput) => Promise<boolean>;

export type UpgradeNudgePreview = {
  userId: string;
  reason: UpgradeNudgeReason;
  props: UpgradeNudgeEmailProps;
};

/**
 * Emails every account that is due the upgrade nudge, up to 100 per run. Each account is claimed
 * (`upgradeNudgeSentAt` set while still null) before its email goes out, so overlapping runs
 * can't both send; the claim is released only when the send is rejected, so a later hourly run
 * retries it inside the 10-day window. `dryRun` returns the recipients and email props in
 * `previews` without claiming or sending.
 */
export async function sendUpgradeNudges({
  now = new Date(),
  send = sendUpgradeNudgeEmail,
  maxSends = UPGRADE_NUDGE_MAX_SENDS,
  dryRun = false,
}: { now?: Date; send?: SendNudge; maxSends?: number; dryRun?: boolean } = {}) {
  const counts = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  const byReason: Partial<Record<UpgradeNudgeReason, number>> = {};
  const previews: UpgradeNudgePreview[] = [];
  const windowStart = new Date(now.getTime() - UPGRADE_NUDGE_MAX_AGE_MS);
  const windowEnd = new Date(now.getTime() - UPGRADE_NUDGE_MIN_AGE_MS);
  const done = () => (dryRun ? previews.length : counts.sent) >= maxSends;
  let cursor = "";

  while (!done()) {
    // The window and the claim column bound the scan to six days of signups; the rest of the
    // rules are applied by isUpgradeNudgeDue so they live in one place.
    const rows = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        banned: user.banned,
        restrictedAt: user.restrictedAt,
        deletedAt: user.deletedAt,
        productEmailsEnabled: user.productEmailsEnabled,
        eventTrackingPausedAt: user.eventTrackingPausedAt,
        upgradeNudgeSentAt: user.upgradeNudgeSentAt,
        monthlyEventCount: user.monthlyEventCount,
        lastEventCountReset: user.lastEventCountReset,
        monthlyLinkCount: user.monthlyLinkCount,
        lastLinkCountReset: user.lastLinkCountReset,
        subscription,
        emailSuppressed: isSuppressedSql(user.email).mapWith(isTrue),
      })
      .from(user)
      .leftJoin(subscription, eq(subscription.userId, user.id))
      .where(
        and(
          gt(user.id, cursor),
          gte(user.createdAt, windowStart),
          lte(user.createdAt, windowEnd),
          isNull(user.upgradeNudgeSentAt),
        ),
      )
      .orderBy(asc(user.id))
      .limit(BATCH_SIZE);
    if (!rows.length) break;
    cursor = rows[rows.length - 1]!.id;

    // Grouped per batch, never per account.
    const ids = rows.map((row) => row.id);
    const [links, clicks, hits, summaries] = await Promise.all([
      db
        .select({ userId: link.userId, links: count() })
        .from(link)
        .where(inArray(link.userId, ids))
        .groupBy(link.userId),
      db
        .select({ userId: link.userId, clicks: count(), firstClickAt: min(linkVisit.createdAt) })
        .from(linkVisit)
        .innerJoin(link, eq(link.id, linkVisit.linkId))
        .where(inArray(link.userId, ids))
        .groupBy(link.userId),
      db
        .select({
          userId: planLimitHit.userId,
          limitKey: planLimitHit.limitKey,
          createdAt: planLimitHit.createdAt,
        })
        .from(planLimitHit)
        .where(and(inArray(planLimitHit.userId, ids), eq(planLimitHit.plan, "free"))),
      db
        .select({ userId: weeklySummaryEmail.userId, at: max(weeklySummaryEmail.createdAt) })
        .from(weeklySummaryEmail)
        .where(
          and(
            inArray(weeklySummaryEmail.userId, ids),
            gte(
              weeklySummaryEmail.createdAt,
              new Date(now.getTime() - UPGRADE_NUDGE_SUMMARY_GAP_MS),
            ),
          ),
        )
        .groupBy(weeklySummaryEmail.userId),
    ]);
    const linksByUser = new Map(links.map((item) => [item.userId, item.links]));
    const clicksByUser = new Map(clicks.map((item) => [item.userId, item]));
    const summaryByUser = new Map(summaries.map((item) => [item.userId, item.at]));

    for (const row of rows) {
      if (done()) break;
      counts.checked++;
      const linkCount = linksByUser.get(row.id) ?? 0;
      const clickCount = clicksByUser.get(row.id)?.clicks ?? 0;
      const limitHits = hits.filter((item) => item.userId === row.id);
      const candidate = {
        ...row,
        plan: resolvePlan(row.subscription, now.getTime()),
        lastWeeklySummaryAt: summaryByUser.get(row.id) ?? null,
        linkCount,
        clickCount,
        freeLimitHitCount: limitHits.length,
      };
      if (!row.email || !row.createdAt || !isUpgradeNudgeDue(candidate, now)) {
        counts.skipped++;
        continue;
      }

      const angle = chooseUpgradeNudgeAngle(
        {
          ...row,
          createdAt: row.createdAt,
          firstClickAt: clicksByUser.get(row.id)?.firstClickAt ?? null,
          limitHits,
        },
        now,
      );
      const props = upgradeNudgeEmailProps(
        row.id,
        {
          name: row.name,
          signupDate: formatDayMonth(row.createdAt),
          linkCount,
          clickCount,
          angle,
        },
        now,
      );

      if (dryRun) {
        previews.push({ userId: row.id, reason: angle.reason, props });
        byReason[angle.reason] = (byReason[angle.reason] ?? 0) + 1;
        continue;
      }

      const [claim] = await db
        .update(user)
        .set({ upgradeNudgeSentAt: now, upgradeNudgeReason: angle.reason })
        .where(and(eq(user.id, row.id), isNull(user.upgradeNudgeSentAt)));
      if (claim.affectedRows !== 1) {
        counts.skipped++;
        continue;
      }

      if (await send({ userId: row.id, email: row.email, props })) {
        counts.sent++;
        byReason[angle.reason] = (byReason[angle.reason] ?? 0) + 1;
      } else {
        counts.failed++;
        await db
          .update(user)
          .set({ upgradeNudgeSentAt: null, upgradeNudgeReason: null })
          .where(eq(user.id, row.id));
      }
    }

    if (rows.length < BATCH_SIZE) break;
  }

  log.info({ ...counts, byReason, dryRun }, "upgrade nudges processed");
  return { ...counts, byReason, previews };
}

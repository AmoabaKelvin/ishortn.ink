import { and, asc, count, eq, gte, inArray, isNull, lt } from "drizzle-orm";

import { effectivePlan } from "@/lib/billing/entitlements";
import { groupReferrers } from "@/lib/core/analytics/referrer";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { link, linkVisit, subscription, user, weeklySummaryEmail } from "@/server/db/schema";

import { isSuppressedSql } from "./notifications/suppression";
import {
  sendWeeklySummaryEmail,
  type SendWeeklySummaryInput,
  type WeeklySummaryContent,
} from "./notifications/weekly-summary";

import type { Plan } from "@/lib/billing/plans";

const log = logger.child({ component: "weekly-summary" });

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKLY_SUMMARY_MIN_CLICKS = 5;
const TOP_LINKS = 3;
const WEEKLY_SUMMARY_MAX_SENDS = 300;
const CHUNK_SIZE = 100;
// Resend allows 2 requests per second per team by default; stay just under it.
const SEND_INTERVAL_MS = 550;
// A run of rejected sends means a rate limit, an exhausted quota or a bad sender: stop and let
// the next scheduled run retry instead of releasing and re-failing every claim.
const MAX_CONSECUTIVE_FAILURES = 5;

// mysql2 returns `exists (...)` as 0 or 1.
const isTrue = (value: number | string) => Number(value) === 1;

// Event counters reset at the start of the month in UTC (the Workers clock).
const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export type SummaryWeek = {
  /** Monday 00:00 UTC of the summarised week. */
  start: Date;
  /** The following Monday 00:00 UTC (exclusive). */
  end: Date;
  /** Monday 00:00 UTC of the week before, for the comparison. */
  previousStart: Date;
  /** `start` as YYYY-MM-DD, the idempotency key. */
  key: string;
  /** "November 16 – 22" or "November 30 – December 6". */
  label: string;
};

function weekStartingAt(start: Date): SummaryWeek {
  const lastDay = new Date(start.getTime() + 6 * DAY_MS);
  const month = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const sameMonth = start.getUTCMonth() === lastDay.getUTCMonth();
  return {
    start,
    end: new Date(start.getTime() + 7 * DAY_MS),
    previousStart: new Date(start.getTime() - 7 * DAY_MS),
    key: start.toISOString().slice(0, 10),
    label: `${month(start)} ${start.getUTCDate()} – ${sameMonth ? "" : `${month(lastDay)} `}${lastDay.getUTCDate()}`,
  };
}

/** The last complete Monday-Sunday week (UTC) before `now`. */
export function summaryWeek(now: Date): SummaryWeek {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceMonday = (now.getUTCDay() + 6) % 7;
  return weekStartingAt(new Date(today - (daysSinceMonday + 7) * DAY_MS));
}

/** The week starting on `key` (YYYY-MM-DD), or null unless it's a Monday. */
export function summaryWeekStarting(key: string): SummaryWeek | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const start = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || start.getUTCDay() !== 1) return null;
  return weekStartingAt(start);
}

export type WeeklySummaryCandidate = {
  email: string | null;
  banned: boolean | null;
  restrictedAt: Date | null;
  deletedAt: Date | null;
  productEmailsEnabled: boolean;
  weeklySummaryEnabled: boolean;
  /** The address has an active hard bounce or complaint. */
  emailSuppressed: boolean;
  /** Clicks on the account's personal links in the summarised week. */
  clicks: number;
};

/** Whether an account gets the summary: enough clicks, both email settings on, reachable. */
export function isWeeklySummaryDue(candidate: WeeklySummaryCandidate): boolean {
  return (
    !!candidate.email &&
    candidate.clicks >= WEEKLY_SUMMARY_MIN_CLICKS &&
    candidate.productEmailsEnabled &&
    candidate.weeklySummaryEnabled &&
    !candidate.emailSuppressed &&
    !candidate.banned &&
    !candidate.restrictedAt &&
    !candidate.deletedAt
  );
}

/** Visits dropped this month by the Free plan's cap, or null when the line doesn't apply. */
export function droppedClicksLine(
  input: { plan: Plan; droppedEventCount: number | null; eventTrackingPausedAt: Date | null },
  now: Date,
): number | null {
  const dropped = input.droppedEventCount ?? 0;
  if (input.plan !== "free" || dropped <= 0 || !input.eventTrackingPausedAt) return null;
  // The counter resets lazily, so a pause from an earlier month is stale.
  return input.eventTrackingPausedAt >= monthStart(now) ? dropped : null;
}

// Values the click pipeline stores when it couldn't resolve a location.
const UNKNOWN_COUNTRIES = new Set(["", "Unknown", "undefined", "N/A"]);

const byClicks = <T extends { clicks: number }>(a: T, b: T) => b.clicks - a.clicks;

/** Assembles the email content from one account's grouped click counts. */
export function buildWeeklySummaryContent(input: {
  week: SummaryWeek;
  clicks: number;
  previousClicks: number;
  links: Array<{ domain: string; alias: string | null; name: string | null; clicks: number }>;
  countries: Array<{ country: string | null; clicks: number }>;
  referrers: Array<{ referer: string | null; clicks: number }>;
  droppedClicks: number | null;
}): WeeklySummaryContent {
  const topLinks = input.links
    .map((row) => ({
      shortUrl: `${row.domain}/${row.alias ?? ""}`,
      name: row.name,
      clicks: row.clicks,
    }))
    .sort((a, b) => byClicks(a, b) || a.shortUrl.localeCompare(b.shortUrl))
    .slice(0, TOP_LINKS);

  const [topCountry] = input.countries
    .filter(
      (row): row is { country: string; clicks: number } =>
        !!row.country && !UNKNOWN_COUNTRIES.has(row.country),
    )
    .sort((a, b) => byClicks(a, b) || a.country.localeCompare(b.country));

  const referers: Record<string, number> = {};
  for (const row of input.referrers) {
    const stored = row.referer ?? "null";
    referers[stored] = (referers[stored] ?? 0) + row.clicks;
  }
  const [topSource] = groupReferrers(referers).sort(
    (a, b) => byClicks(a, b) || a.source.localeCompare(b.source),
  );

  return {
    weekLabel: input.week.label,
    clicks: input.clicks,
    previousClicks: input.previousClicks,
    topLinks,
    topCountry: topCountry ? { name: topCountry.country, clicks: topCountry.clicks } : null,
    topSource: topSource ? { name: topSource.name, clicks: topSource.clicks } : null,
    droppedClicks: input.droppedClicks,
  };
}

// Matches the analytics overview: personal-workspace links, without QR codes and bio-page links.
const personalLinks = and(isNull(link.teamId), eq(link.isQrCode, false), eq(link.isBioLink, false));
const visitedBetween = (from: Date, to: Date) =>
  and(gte(linkVisit.createdAt, from), lt(linkVisit.createdAt, to));

type SendSummary = (input: SendWeeklySummaryInput) => Promise<boolean>;

export type WeeklySummaryPreview = { userId: string; content: WeeklySummaryContent };

/**
 * Emails last week's click summary to every account whose personal links got at least 5 clicks,
 * up to 300 per run, paced under Resend's rate limit. Each send is claimed first by inserting the
 * (user, week) row, so retried or overlapping runs never send a week twice; a rejected send
 * removes its claim so the next run retries it. `dryRun` returns the recipients and contents in
 * `previews` without claiming or sending.
 *
 * Reads raw visits: LinkVisitDailySummary is only written for visits past retention and holds
 * no country or source. The range is indexed (LinkVisit.createdAt) and the job runs weekly.
 */
export async function sendWeeklySummaries({
  now = new Date(),
  week = summaryWeek(now),
  send = sendWeeklySummaryEmail,
  maxSends = WEEKLY_SUMMARY_MAX_SENDS,
  sendIntervalMs = SEND_INTERVAL_MS,
  dryRun = false,
}: {
  now?: Date;
  week?: SummaryWeek;
  send?: SendSummary;
  maxSends?: number;
  sendIntervalMs?: number;
  dryRun?: boolean;
} = {}) {
  const counts = { candidates: 0, alreadySent: 0, sent: 0, skipped: 0, failed: 0 };
  const previews: WeeklySummaryPreview[] = [];

  // One row per account with clicks, so the result is bounded by active accounts.
  const totals = await db
    .select({ userId: link.userId, clicks: count() })
    .from(linkVisit)
    .innerJoin(link, eq(link.id, linkVisit.linkId))
    .where(and(visitedBetween(week.start, week.end), personalLinks))
    .groupBy(link.userId)
    .having(gte(count(), WEEKLY_SUMMARY_MIN_CLICKS))
    .orderBy(asc(link.userId));
  counts.candidates = totals.length;

  const claimed = new Set(
    (
      await db
        .select({ userId: weeklySummaryEmail.userId })
        .from(weeklySummaryEmail)
        .where(eq(weeklySummaryEmail.weekStart, week.key))
    ).map((row) => row.userId),
  );
  const pending = totals.filter((row) => !claimed.has(row.userId));
  counts.alreadySent = totals.length - pending.length;

  let lastSendAt = 0;
  let consecutiveFailures = 0;
  const done = () =>
    (dryRun ? previews.length : counts.sent) >= maxSends ||
    consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;

  for (let offset = 0; offset < pending.length && !done(); offset += CHUNK_SIZE) {
    const chunk = pending.slice(offset, offset + CHUNK_SIZE);
    const clicksByUser = new Map(chunk.map((row) => [row.userId, row.clicks]));

    const users = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        banned: user.banned,
        restrictedAt: user.restrictedAt,
        deletedAt: user.deletedAt,
        productEmailsEnabled: user.productEmailsEnabled,
        weeklySummaryEnabled: user.weeklySummaryEnabled,
        droppedEventCount: user.droppedEventCount,
        eventTrackingPausedAt: user.eventTrackingPausedAt,
        planGracePlan: user.planGracePlan,
        planGraceEndsAt: user.planGraceEndsAt,
        planGraceReason: user.planGraceReason,
        subscription,
        emailSuppressed: isSuppressedSql(user.email).mapWith(isTrue),
      })
      .from(user)
      .leftJoin(subscription, eq(subscription.userId, user.id))
      .where(inArray(user.id, [...clicksByUser.keys()]))
      .orderBy(asc(user.id));

    const due = users.filter((row) =>
      isWeeklySummaryDue({ ...row, clicks: clicksByUser.get(row.id) ?? 0 }),
    );
    counts.skipped += chunk.length - due.length;
    if (!due.length) continue;

    // Grouped per chunk, never per account.
    const dueIds = due.map((row) => row.id);
    const forDue = (from: Date, to: Date) =>
      and(visitedBetween(from, to), personalLinks, inArray(link.userId, dueIds));
    const [previous, links, countries, referrers] = await Promise.all([
      db
        .select({ userId: link.userId, clicks: count() })
        .from(linkVisit)
        .innerJoin(link, eq(link.id, linkVisit.linkId))
        .where(forDue(week.previousStart, week.start))
        .groupBy(link.userId),
      db
        .select({
          userId: link.userId,
          domain: link.domain,
          alias: link.alias,
          name: link.name,
          clicks: count(),
        })
        .from(linkVisit)
        .innerJoin(link, eq(link.id, linkVisit.linkId))
        .where(forDue(week.start, week.end))
        .groupBy(link.id),
      db
        .select({ userId: link.userId, country: linkVisit.country, clicks: count() })
        .from(linkVisit)
        .innerJoin(link, eq(link.id, linkVisit.linkId))
        .where(forDue(week.start, week.end))
        .groupBy(link.userId, linkVisit.country),
      db
        .select({ userId: link.userId, referer: linkVisit.referer, clicks: count() })
        .from(linkVisit)
        .innerJoin(link, eq(link.id, linkVisit.linkId))
        .where(forDue(week.start, week.end))
        .groupBy(link.userId, linkVisit.referer),
    ]);
    const previousByUser = new Map(previous.map((row) => [row.userId, row.clicks]));

    for (const row of due) {
      if (done()) break;
      if (!row.email) continue;
      const clicks = clicksByUser.get(row.id) ?? 0;
      const content = buildWeeklySummaryContent({
        week,
        clicks,
        previousClicks: previousByUser.get(row.id) ?? 0,
        links: links.filter((item) => item.userId === row.id),
        countries: countries.filter((item) => item.userId === row.id),
        referrers: referrers.filter((item) => item.userId === row.id),
        droppedClicks: droppedClicksLine(
          { ...row, plan: effectivePlan(row.subscription ?? undefined, row, now) },
          now,
        ),
      });

      if (dryRun) {
        previews.push({ userId: row.id, content });
        continue;
      }

      const [claim] = await db
        .insert(weeklySummaryEmail)
        .ignore()
        .values({ userId: row.id, weekStart: week.key, clicks });
      if (claim.affectedRows !== 1) {
        counts.alreadySent++;
        continue;
      }

      const wait = lastSendAt + sendIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastSendAt = Date.now();

      if (await send({ userId: row.id, email: row.email, name: row.name, content })) {
        counts.sent++;
        consecutiveFailures = 0;
        await db
          .update(weeklySummaryEmail)
          .set({ sentAt: new Date() })
          .where(
            and(eq(weeklySummaryEmail.userId, row.id), eq(weeklySummaryEmail.weekStart, week.key)),
          );
      } else {
        counts.failed++;
        consecutiveFailures++;
        await db
          .delete(weeklySummaryEmail)
          .where(
            and(
              eq(weeklySummaryEmail.userId, row.id),
              eq(weeklySummaryEmail.weekStart, week.key),
              isNull(weeklySummaryEmail.sentAt),
            ),
          );
      }
    }
  }

  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    log.warn(
      { ...counts, week: week.key },
      "weekly summaries stopped after repeated send failures",
    );
  }
  log.info({ ...counts, week: week.key, dryRun }, "weekly summaries processed");
  return { week: week.key, ...counts, previews };
}

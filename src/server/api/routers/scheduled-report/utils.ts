import { groupReferrers } from "@/lib/core/analytics/referrer";
import { summaryWeek, UNKNOWN_COUNTRIES } from "@/server/lib/weekly-summary";

import type {
  ScheduledReportFrequency,
  ScheduledReportTargetType,
} from "@/emails/scheduled-report";
import type { WeeklySummaryTop, WeeklySummaryTopLink } from "@/emails/weekly-summary";
import type { ScheduledReportContent } from "@/server/lib/notifications/scheduled-report";

const TOP_ROWS = 5;

export type ReportPeriod = {
  frequency: ScheduledReportFrequency;
  /** First instant of the reported period, UTC. */
  start: Date;
  /** First instant after it (exclusive). */
  end: Date;
  /** Start of the period before, for the comparison. */
  previousStart: Date;
  /** "w:2026-11-16" or "m:2026-10-01": the frequency and start date, stored once sent. */
  key: string;
  /** "16-22 Nov" or "October 2026". */
  label: string;
};

/**
 * The last complete period before `now`: the Monday-Sunday week for weekly reports (the same
 * week as the weekly summary), the calendar month for monthly ones. UTC throughout.
 */
export function reportPeriod(frequency: ScheduledReportFrequency, now: Date): ReportPeriod {
  if (frequency === "weekly") {
    const week = summaryWeek(now);
    return { frequency, ...week, key: `w:${week.key}` };
  }
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month - 1, 1));
  return {
    frequency,
    start,
    end: new Date(Date.UTC(year, month, 1)),
    previousStart: new Date(Date.UTC(year, month - 2, 1)),
    key: `m:${start.toISOString().slice(0, 10)}`,
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

type Owned = { userId: string; teamId: number | null };

/** Whether `row` lives in the report's workspace: the same team, or the same personal account. */
export function inReportWorkspace(report: Owned, row: Owned): boolean {
  return report.teamId === null
    ? row.teamId === null && row.userId === report.userId
    : row.teamId === report.teamId;
}

/**
 * Which schedules a workspace's plan covers: all of them without a cap, else the oldest `cap`.
 * More than `cap` only exist after a downgrade; the newest ones pause until it's lifted.
 */
export function coveredScheduleIds(ids: number[], cap: number | undefined): Set<number> {
  const sorted = [...ids].sort((a, b) => a - b);
  return new Set(cap === undefined ? sorted : sorted.slice(0, cap));
}

/** Recipients who still get the report: not unsubscribed and not bounced or complained. */
export function activeRecipients(
  recipients: string[],
  unsubscribed: string[] | null,
  suppressed: Set<string>,
): string[] {
  const off = new Set(unsubscribed ?? []);
  return recipients.filter((email) => !off.has(email) && !suppressed.has(email));
}

const byClicks = <T extends { clicks: number }>(a: T, b: T) => b.clicks - a.clicks;

function topRows(counts: Map<string, number>): WeeklySummaryTop[] {
  return [...counts]
    .map(([name, clicks]) => ({ name, clicks }))
    .sort((a, b) => byClicks(a, b) || a.name.localeCompare(b.name))
    .slice(0, TOP_ROWS);
}

function tally<T>(rows: T[], key: (row: T) => string | null, clicks: (row: T) => number) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = key(row);
    if (name) counts.set(name, (counts.get(name) ?? 0) + clicks(row));
  }
  return counts;
}

// ua-parser-js reports "mobile"/"tablet" while the fallback writes "Mobile"/"Desktop"; the
// analytics pages title-case them into one row each, and so does the report.
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Assembles one report from its links' grouped click counts in the period. */
export function buildScheduledReportContent(input: {
  period: ReportPeriod;
  targetType: ScheduledReportTargetType;
  targetName: string;
  senderName: string;
  statsUrl: string | null;
  previousClicks: number;
  links: Array<{ domain: string; alias: string | null; name: string | null; clicks: number }>;
  countries: Array<{ country: string | null; clicks: number }>;
  devices: Array<{ device: string | null; clicks: number }>;
  referrers: Array<{ referer: string | null; clicks: number }>;
}): ScheduledReportContent {
  const topLinks: WeeklySummaryTopLink[] =
    input.targetType === "link"
      ? []
      : input.links
          .filter((row) => row.clicks > 0)
          .map((row) => ({
            shortUrl: `${row.domain}/${row.alias ?? ""}`,
            name: row.name,
            clicks: row.clicks,
          }))
          .sort((a, b) => byClicks(a, b) || a.shortUrl.localeCompare(b.shortUrl))
          .slice(0, TOP_ROWS);

  const countries = tally(
    input.countries,
    (row) => (row.country && !UNKNOWN_COUNTRIES.has(row.country) ? row.country : null),
    (row) => row.clicks,
  );
  const devices = tally(
    input.devices,
    (row) => (row.device ? titleCase(row.device) : null),
    (row) => row.clicks,
  );

  const referers: Record<string, number> = {};
  for (const row of input.referrers) {
    const stored = row.referer ?? "null";
    referers[stored] = (referers[stored] ?? 0) + row.clicks;
  }
  const sources = tally(
    groupReferrers(referers),
    (row) => row.name,
    (row) => row.clicks,
  );

  return {
    frequency: input.period.frequency,
    periodLabel: input.period.label,
    targetType: input.targetType,
    targetName: input.targetName,
    senderName: input.senderName,
    clicks: input.links.reduce((total, row) => total + row.clicks, 0),
    previousClicks: input.previousClicks,
    topLinks,
    countries: topRows(countries),
    devices: topRows(devices),
    sources: topRows(sources),
    statsUrl: input.statsUrl,
  };
}

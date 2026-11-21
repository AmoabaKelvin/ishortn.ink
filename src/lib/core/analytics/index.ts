import { subDays } from "date-fns";

import type { RouterOutputs } from "@/trpc/shared";

function safeIncrement<T extends string>(record: Record<T, number>, key: T): void {
  record[key] = (record[key] || 0) + 1;
}

export type SeriesGranularity = "day" | "hour";

// Buckets are UTC so live visits line up with the daily summaries the cleanup
// job archives (keyed by UTC date). Charts label the axis as UTC.
export const bucketKey = (date: Date, granularity: SeriesGranularity = "day") =>
  date.toISOString().slice(0, granularity === "hour" ? 13 : 10);

const parseBucketKey = (key: string) =>
  new Date(key.length > 10 ? `${key}:00:00.000Z` : `${key}T00:00:00.000Z`);

// ua-parser-js reports "mobile"/"tablet" while our fallback writes "Mobile"/
// "Desktop", so normalise before counting to keep one row per device type.
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

type AggregateVisitsParams = {
  visits: RouterOutputs["link"]["linkVisits"]["totalVisits"];
  uniqueVisits: RouterOutputs["link"]["linkVisits"]["uniqueVisits"];
};

export const aggregateVisits = (
  visits: AggregateVisitsParams["visits"],
  uniqueVisits: AggregateVisitsParams["uniqueVisits"],
  // "hour" keys `clicksPerDate` by "YYYY-MM-DDTHH" instead of "YYYY-MM-DD".
  granularity: SeriesGranularity = "day",
) => {
  const clicksPerDate: Record<string, number> = {};
  const uniqueClicksPerDate: Record<string, number> = {};
  const verifiedClicksPerDate: Record<string, number> = {};
  const clicksPerCountry: Record<string, number> = {};
  const clicksPerCity: Record<string, number> = {};
  const clicksPerContinent: Record<string, number> = {};
  const clicksPerDevice: Record<string, number> = {};
  const clicksPerOS: Record<string, number> = {};
  const clicksPerBrowser: Record<string, number> = {};
  const clicksPerModel: Record<string, number> = {};
  let totalClicks = 0;
  let verifiedClicks = 0;

  visits.forEach((visit) => {
    const date = bucketKey(new Date(visit.createdAt!), granularity);
    safeIncrement(clicksPerDate, date);
    totalClicks += 1;

    if (visit.verifiedAt) {
      verifiedClicks += 1;
      safeIncrement(verifiedClicksPerDate, date);
    }

    if (visit.country) safeIncrement(clicksPerCountry, visit.country);
    if (visit.city) safeIncrement(clicksPerCity, visit.city);
    if (visit.continent) safeIncrement(clicksPerContinent, visit.continent);
    if (visit.device) safeIncrement(clicksPerDevice, titleCase(visit.device));
    if (visit.os) safeIncrement(clicksPerOS, visit.os);
    if (visit.browser) safeIncrement(clicksPerBrowser, visit.browser);
    if (visit.model) safeIncrement(clicksPerModel, visit.model);
  });

  if (!uniqueVisits)
    return {
      totalClicks,
      verifiedClicks,
      clicksPerDate,
      verifiedClicksPerDate,
      clicksPerCountry,
      clicksPerCity,
      clicksPerContinent,
      clicksPerDevice,
      clicksPerOS,
      clicksPerBrowser,
      clicksPerModel,
    };

  uniqueVisits.forEach((uniqueVisit) => {
    safeIncrement(uniqueClicksPerDate, bucketKey(new Date(uniqueVisit.createdAt!), granularity));
  });

  return {
    totalClicks,
    verifiedClicks,
    clicksPerDate,
    uniqueClicksPerDate,
    verifiedClicksPerDate,
    clicksPerCountry,
    clicksPerCity,
    clicksPerContinent,
    clicksPerDevice,
    clicksPerOS,
    clicksPerBrowser,
    clicksPerModel,
  };
};

export type ArchivedClicks = {
  clicks: number;
  uniqueClicks: number;
  clicksPerDate: Record<string, number>;
  uniqueClicksPerDate: Record<string, number>;
};

// Raw visits older than the retention window are rolled up into daily
// summaries by the cleanup job. Only counts survive, so per-date series and
// totals can include them but country/device/referrer breakdowns cannot.
export const mergeArchivedClicks = (
  aggregated: {
    clicksPerDate: Record<string, number>;
    uniqueClicksPerDate?: Record<string, number>;
  },
  archived: ArchivedClicks,
) => {
  const clicksPerDate = { ...aggregated.clicksPerDate };
  const uniqueClicksPerDate = { ...aggregated.uniqueClicksPerDate };
  for (const [date, n] of Object.entries(archived.clicksPerDate)) {
    clicksPerDate[date] = (clicksPerDate[date] ?? 0) + n;
  }
  for (const [date, n] of Object.entries(archived.uniqueClicksPerDate)) {
    uniqueClicksPerDate[date] = (uniqueClicksPerDate[date] ?? 0) + n;
  }
  const sortByDate = (m: Record<string, number>) =>
    Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  return {
    clicksPerDate: sortByDate(clicksPerDate),
    uniqueClicksPerDate: sortByDate(uniqueClicksPerDate),
  };
};

export const summarizeArchived = (
  rows: { date: string; clicks: number; uniqueClicks: number }[],
): ArchivedClicks =>
  rows.reduce<ArchivedClicks>(
    (acc, s) => {
      acc.clicks += s.clicks;
      acc.uniqueClicks += s.uniqueClicks;
      acc.clicksPerDate[s.date] = (acc.clicksPerDate[s.date] ?? 0) + s.clicks;
      acc.uniqueClicksPerDate[s.date] = (acc.uniqueClicksPerDate[s.date] ?? 0) + s.uniqueClicks;
      return acc;
    },
    { clicks: 0, uniqueClicks: 0, clicksPerDate: {}, uniqueClicksPerDate: {} },
  );

/**
 * The analytics window a plan may see: the trailing `limitDays` days ending at
 * `now`, or all time (`days`/`from` null) when the plan has no limit.
 */
export const analyticsWindow = (limitDays: number | undefined, now: Date) => ({
  days: limitDays ?? null,
  from: limitDays === undefined ? null : subDays(now, limitDays),
  to: now,
});

export type RangeWindow = {
  /** Null for all time. */
  from: Date | null;
  to: Date;
  granularity: SeriesGranularity;
};

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * The window an analytics range covers, aligned to whole UTC buckets so every
 * bucket on the chart is complete except the current one: "7d" is today plus
 * the six days before it, "24h" is the current hour plus the 23 before it.
 */
export const resolveRangeWindow = (range: string, now: Date): RangeWindow => {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = Date.UTC(y, m, now.getUTCDate());
  const days = (n: number): RangeWindow => ({
    from: new Date(today - (n - 1) * DAY_MS),
    to: now,
    granularity: "day",
  });

  switch (range) {
    case "24h":
      return {
        from: new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS - 23 * HOUR_MS),
        to: now,
        granularity: "hour",
      };
    case "30d":
      return days(30);
    case "90d":
      return days(90);
    case "this_month":
      return { from: new Date(Date.UTC(y, m, 1)), to: now, granularity: "day" };
    case "last_month":
      return {
        from: new Date(Date.UTC(y, m - 1, 1)),
        to: new Date(Date.UTC(y, m, 1) - 1),
        granularity: "day",
      };
    case "this_year":
      return { from: new Date(Date.UTC(y, 0, 1)), to: now, granularity: "day" };
    case "last_year":
      return {
        from: new Date(Date.UTC(y - 1, 0, 1)),
        to: new Date(Date.UTC(y, 0, 1) - 1),
        granularity: "day",
      };
    case "all":
      return { from: null, to: now, granularity: "day" };
    default:
      return days(7);
  }
};

export type ClickSeriesPoint = { date: string; clicks: number; uniqueClicks: number };

/**
 * One point per bucket in the window, zero-filled, so gaps plot as zero rather
 * than being bridged. All-time windows start at the earliest bucket with data;
 * with no data at all there is nothing to plot.
 */
export const fillClickSeries = (
  series: { clicksPerDate: Record<string, number>; uniqueClicksPerDate?: Record<string, number> },
  window: RangeWindow,
): ClickSeriesPoint[] => {
  const { granularity } = window;
  const earliest = Object.keys(series.clicksPerDate).sort()[0];
  const from = window.from ?? (earliest ? parseBucketKey(earliest) : null);
  if (!from) return [];

  const step = granularity === "hour" ? HOUR_MS : DAY_MS;
  const end = parseBucketKey(bucketKey(window.to, granularity)).getTime();
  const points: ClickSeriesPoint[] = [];
  for (let t = parseBucketKey(bucketKey(from, granularity)).getTime(); t <= end; t += step) {
    const date = bucketKey(new Date(t), granularity);
    points.push({
      date,
      clicks: series.clicksPerDate[date] ?? 0,
      uniqueClicks: series.uniqueClicksPerDate?.[date] ?? 0,
    });
  }
  return points;
};

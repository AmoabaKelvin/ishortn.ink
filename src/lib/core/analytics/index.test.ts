import { describe, expect, test } from "bun:test";

import {
  aggregateVisits,
  analyticsWindow,
  bucketKey,
  fillClickSeries,
  mergeArchivedClicks,
  parseCustomRange,
  resolveAnalyticsRange,
  resolveRangeWindow,
  summarizeArchived,
} from ".";

describe("analyticsWindow", () => {
  const now = new Date("2026-11-20T12:00:00Z");

  test("a capped plan gets the trailing window ending now", () => {
    expect(analyticsWindow(7, now)).toEqual({
      days: 7,
      from: new Date("2026-11-13T12:00:00Z"),
      to: now,
    });
  });

  test("an uncapped plan gets all time", () => {
    expect(analyticsWindow(undefined, now)).toEqual({ days: null, from: null, to: now });
  });
});

describe("parseCustomRange", () => {
  test("accepts ordered, real calendar days", () => {
    expect(parseCustomRange("2026-10-05", "2026-10-12")).toEqual({
      from: "2026-10-05",
      to: "2026-10-12",
    });
    expect(parseCustomRange("2026-10-05", "2026-10-05")).not.toBeNull();
  });

  test("rejects missing, malformed, impossible and reversed days", () => {
    expect(parseCustomRange(undefined, "2026-10-12")).toBeNull();
    expect(parseCustomRange("2026-10-5", "2026-10-12")).toBeNull();
    expect(parseCustomRange("2026-02-30", "2026-03-02")).toBeNull();
    expect(parseCustomRange("2026-10-12", "2026-10-05")).toBeNull();
  });
});

describe("resolveAnalyticsRange", () => {
  const custom = { range: "custom", from: "2026-10-05", to: "2026-10-12" };

  test("free plans keep 24h and 7d and fall back to 7d for everything else", () => {
    expect(resolveAnalyticsRange({ range: "24h" }, false)).toEqual({ range: "24h", custom: null });
    for (const range of ["30d", "last_month", "all"]) {
      expect(resolveAnalyticsRange({ range }, false)).toEqual({ range: "7d", custom: null });
    }
    expect(resolveAnalyticsRange(custom, false)).toEqual({ range: "7d", custom: null });
  });

  test("paid plans get last month and custom ranges", () => {
    expect(resolveAnalyticsRange({ range: "last_month" }, true)).toEqual({
      range: "last_month",
      custom: null,
    });
    expect(resolveAnalyticsRange(custom, true)).toEqual({
      range: "custom",
      custom: { from: "2026-10-05", to: "2026-10-12" },
    });
  });

  test("a custom range without valid days falls back to 7d", () => {
    expect(resolveAnalyticsRange({ range: "custom", from: "2026-10-12" }, true)).toEqual({
      range: "7d",
      custom: null,
    });
  });
});

describe("resolveRangeWindow", () => {
  const now = new Date("2026-11-20T15:42:10Z");

  test("7d covers today plus the six whole UTC days before it", () => {
    expect(resolveRangeWindow("7d", now)).toEqual({
      from: new Date("2026-11-14T00:00:00Z"),
      to: now,
      granularity: "day",
    });
  });

  test("24h is hourly: the current hour plus the 23 before it", () => {
    expect(resolveRangeWindow("24h", now)).toEqual({
      from: new Date("2026-11-19T16:00:00Z"),
      to: now,
      granularity: "hour",
    });
  });

  test("calendar ranges start on UTC boundaries", () => {
    expect(resolveRangeWindow("this_month", now).from).toEqual(new Date("2026-11-01T00:00:00Z"));
    expect(resolveRangeWindow("this_year", now).from).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(resolveRangeWindow("last_month", now)).toEqual({
      from: new Date("2026-10-01T00:00:00Z"),
      to: new Date("2026-10-31T23:59:59.999Z"),
      granularity: "day",
    });
  });

  test("custom ranges cover whole UTC days and stop at now", () => {
    expect(resolveRangeWindow("custom", now, { from: "2026-10-05", to: "2026-10-12" })).toEqual({
      from: new Date("2026-10-05T00:00:00Z"),
      to: new Date("2026-10-12T23:59:59.999Z"),
      granularity: "day",
    });
    expect(resolveRangeWindow("custom", now, { from: "2026-11-10", to: "2026-11-20" }).to).toEqual(
      now,
    );
  });

  test("a one-day custom range plots by hour; a missing one falls back to 7d", () => {
    expect(
      resolveRangeWindow("custom", now, { from: "2026-11-02", to: "2026-11-02" }).granularity,
    ).toBe("hour");
    expect(resolveRangeWindow("custom", now, null)).toEqual(resolveRangeWindow("7d", now));
  });

  test("all time has no start; unknown ranges fall back to 7d", () => {
    expect(resolveRangeWindow("all", now).from).toBeNull();
    expect(resolveRangeWindow("bogus", now)).toEqual(resolveRangeWindow("7d", now));
  });
});

describe("fillClickSeries", () => {
  const now = new Date("2026-11-20T15:42:10Z");

  test("a single click shows as one day at 1 among zeros", () => {
    const series = fillClickSeries(
      { clicksPerDate: { "2026-11-18": 1 }, uniqueClicksPerDate: { "2026-11-18": 1 } },
      resolveRangeWindow("7d", now),
    );
    expect(series).toHaveLength(7);
    expect(series[0]).toEqual({ date: "2026-11-14", clicks: 0, uniqueClicks: 0 });
    expect(series.at(-1)?.date).toBe("2026-11-20");
    expect(series.filter((p) => p.clicks > 0)).toEqual([
      { date: "2026-11-18", clicks: 1, uniqueClicks: 1 },
    ]);
  });

  test("24h yields 24 hourly buckets", () => {
    const series = fillClickSeries(
      { clicksPerDate: { "2026-11-20T09": 3 } },
      resolveRangeWindow("24h", now),
    );
    expect(series).toHaveLength(24);
    expect(series[0]?.date).toBe("2026-11-19T16");
    expect(series.at(-1)?.date).toBe("2026-11-20T15");
    expect(series.find((p) => p.date === "2026-11-20T09")?.clicks).toBe(3);
  });

  test("all time starts at the earliest day with data, or is empty", () => {
    const window = resolveRangeWindow("all", now);
    const series = fillClickSeries({ clicksPerDate: { "2026-11-10": 2, "2026-11-12": 1 } }, window);
    expect(series).toHaveLength(11);
    expect(series[0]).toEqual({ date: "2026-11-10", clicks: 2, uniqueClicks: 0 });
    expect(fillClickSeries({ clicksPerDate: {} }, window)).toEqual([]);
  });

  test("sums of the filled series match live plus archived totals", () => {
    // Visits every day for 110 days; anything older than 30 days is archived.
    const visits = Array.from({ length: 110 }, (_, i) => ({
      createdAt: new Date(now.getTime() - i * 86_400_000),
    }));
    const live = visits.slice(0, 30);
    const archivedRows = visits.slice(30).map((v) => ({
      date: bucketKey(v.createdAt),
      clicks: 5,
      uniqueClicks: 2,
    }));
    // SAFETY: aggregateVisits only reads createdAt for these assertions.
    const aggregated = aggregateVisits(live as never, live as never);
    const archived = summarizeArchived(archivedRows);
    const series = fillClickSeries(
      mergeArchivedClicks(aggregated, archived),
      resolveRangeWindow("all", now),
    );
    expect(series).toHaveLength(110);
    expect(series.reduce((n, p) => n + p.clicks, 0)).toBe(30 + archived.clicks);
    expect(series.reduce((n, p) => n + p.uniqueClicks, 0)).toBe(30 + archived.uniqueClicks);
  });
});

describe("summarizeArchived", () => {
  test("overview totals over date-grouped rows equal the per-link pages added up", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    const window = resolveRangeWindow("all", now);
    const day = (n: number) => new Date(now.getTime() - n * 86_400_000);
    // Two links with archived days that overlap (40, 41) and differ (60 / 90).
    const links = [
      {
        live: [{ createdAt: day(0) }, { createdAt: day(3) }],
        rows: [
          { date: bucketKey(day(40)), clicks: 120, uniqueClicks: 30 },
          { date: bucketKey(day(41)), clicks: 7, uniqueClicks: 7 },
          { date: bucketKey(day(60)), clicks: 1, uniqueClicks: 1 },
        ],
      },
      {
        live: [{ createdAt: day(3) }],
        rows: [
          { date: bucketKey(day(40)), clicks: 5, uniqueClicks: 4 },
          { date: bucketKey(day(41)), clicks: 2, uniqueClicks: 1 },
          { date: bucketKey(day(90)), clicks: 9, uniqueClicks: 3 },
        ],
      },
    ];

    // Per-link page: its own live visits plus its own summary rows.
    const perLink = links.map(({ live, rows }) => {
      // SAFETY: aggregateVisits only reads createdAt for these assertions.
      const aggregated = aggregateVisits(live as never, live as never);
      return fillClickSeries(mergeArchivedClicks(aggregated, summarizeArchived(rows)), window);
    });

    // Overview: every link's live visits, and summary rows summed per date in SQL.
    const grouped = new Map<string, { date: string; clicks: number; uniqueClicks: number }>();
    for (const row of links.flatMap((l) => l.rows)) {
      const acc = grouped.get(row.date) ?? { date: row.date, clicks: 0, uniqueClicks: 0 };
      acc.clicks += row.clicks;
      acc.uniqueClicks += row.uniqueClicks;
      grouped.set(row.date, acc);
    }
    const allLive = links.flatMap((l) => l.live);
    const archived = summarizeArchived([...grouped.values()]);
    // SAFETY: as above, only createdAt is read.
    const aggregated = aggregateVisits(allLive as never, allLive as never);
    const overview = fillClickSeries(mergeArchivedClicks(aggregated, archived), window);

    const total = (series: { clicks: number }[]) => series.reduce((n, p) => n + p.clicks, 0);
    expect(archived.clicks).toBe(144);
    expect(archived.uniqueClicks).toBe(46);
    expect(total(overview)).toBe(perLink.reduce((n, s) => n + total(s), 0));
    expect(allLive.length + archived.clicks).toBe(total(overview));
    // Day by day the overview equals the sum of the per-link series.
    for (const point of overview) {
      const sum = perLink.reduce(
        (n, s) => n + (s.find((p) => p.date === point.date)?.clicks ?? 0),
        0,
      );
      expect(point.clicks).toBe(sum);
    }
    expect(overview.find((p) => p.date === bucketKey(day(40)))?.uniqueClicks).toBe(34);
  });
});

describe("aggregateVisits", () => {
  test("buckets by hour and merges device casing", () => {
    const visits = [
      { createdAt: new Date("2026-11-20T09:05:00Z"), device: "mobile" },
      { createdAt: new Date("2026-11-20T09:55:00Z"), device: "Mobile" },
      { createdAt: new Date("2026-11-20T10:01:00Z"), device: "Desktop" },
    ];
    // SAFETY: aggregateVisits only reads the fields set above; the rest are optional in practice.
    const result = aggregateVisits(visits as never, [] as never, "hour");
    expect(result.clicksPerDate).toEqual({ "2026-11-20T09": 2, "2026-11-20T10": 1 });
    expect(result.clicksPerDevice).toEqual({ Mobile: 2, Desktop: 1 });
  });
});

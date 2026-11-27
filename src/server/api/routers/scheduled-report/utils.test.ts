import { describe, expect, test } from "bun:test";

import {
  activeRecipients,
  buildScheduledReportContent,
  coveredScheduleIds,
  inReportWorkspace,
  reportPeriod,
} from "./utils";

describe("reportPeriod", () => {
  test("weekly is the last Monday-Sunday week, like the weekly summary", () => {
    const period = reportPeriod("weekly", new Date("2026-11-23T00:10:00Z"));
    expect(period.key).toBe("w:2026-11-16");
    expect(period.start.toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-11-23T00:00:00.000Z");
    expect(period.previousStart.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(period.label).toBe("16-22 Nov");
  });

  test("monthly is the previous calendar month, compared with the month before it", () => {
    const period = reportPeriod("monthly", new Date("2026-12-01T00:10:00Z"));
    expect(period.key).toBe("m:2026-11-01");
    expect(period.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(period.previousStart.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(period.label).toBe("November 2026");
  });

  test("any time in a month picks the same previous month", () => {
    expect(reportPeriod("monthly", new Date("2026-11-30T23:59:59Z")).key).toBe("m:2026-10-01");
  });

  test("January reports on December of the year before", () => {
    const period = reportPeriod("monthly", new Date("2027-01-01T05:00:00Z"));
    expect(period.key).toBe("m:2026-12-01");
    expect(period.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(period.previousStart.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(period.label).toBe("December 2026");
  });

  test("weekly and monthly keys never collide on a Monday the 1st", () => {
    const now = new Date("2026-06-08T00:10:00Z");
    expect(reportPeriod("weekly", now).key).toBe("w:2026-06-01");
    expect(reportPeriod("monthly", new Date("2026-07-01T00:10:00Z")).key).toBe("m:2026-06-01");
  });
});

describe("inReportWorkspace", () => {
  const personal = { userId: "user_a", teamId: null };
  const team = { userId: "user_a", teamId: 7 };

  test("personal schedules cover the account's personal rows only", () => {
    expect(inReportWorkspace(personal, { userId: "user_a", teamId: null })).toBe(true);
    expect(inReportWorkspace(personal, { userId: "user_b", teamId: null })).toBe(false);
    expect(inReportWorkspace(personal, { userId: "user_a", teamId: 7 })).toBe(false);
  });

  test("team schedules cover any member's rows in the team", () => {
    expect(inReportWorkspace(team, { userId: "user_b", teamId: 7 })).toBe(true);
    expect(inReportWorkspace(team, { userId: "user_a", teamId: null })).toBe(false);
    expect(inReportWorkspace(team, { userId: "user_a", teamId: 8 })).toBe(false);
  });
});

describe("coveredScheduleIds", () => {
  test("no cap covers every schedule", () => {
    expect([...coveredScheduleIds([4, 1, 9, 2], undefined)]).toEqual([1, 2, 4, 9]);
  });

  test("a cap keeps the oldest schedules", () => {
    expect([...coveredScheduleIds([9, 4, 1, 2], 3)]).toEqual([1, 2, 4]);
  });
});

describe("activeRecipients", () => {
  test("drops unsubscribed and suppressed addresses", () => {
    expect(
      activeRecipients(
        ["a@example.com", "b@example.com", "c@example.com"],
        ["b@example.com"],
        new Set(["c@example.com"]),
      ),
    ).toEqual(["a@example.com"]);
    expect(activeRecipients(["a@example.com"], null, new Set())).toEqual(["a@example.com"]);
  });
});

describe("buildScheduledReportContent", () => {
  const period = reportPeriod("weekly", new Date("2026-11-23T00:10:00Z"));
  const base = {
    period,
    senderName: "Ama Mensah",
    statsUrl: null,
    previousClicks: 4,
    countries: [],
    devices: [],
    referrers: [],
  };
  const links = [
    { domain: "ishortn.ink", alias: "a", name: null, clicks: 2 },
    { domain: "ishortn.ink", alias: "b", name: "Launch", clicks: 9 },
    { domain: "go.acme.com", alias: "c", name: null, clicks: 0 },
  ];

  test("totals the clicks and lists top links for a folder, skipping links without clicks", () => {
    const content = buildScheduledReportContent({
      ...base,
      targetType: "folder",
      targetName: "Clients",
      links,
    });
    expect(content).toMatchObject({
      frequency: "weekly",
      periodLabel: "16-22 Nov",
      targetType: "folder",
      targetName: "Clients",
      senderName: "Ama Mensah",
      clicks: 11,
      previousClicks: 4,
      statsUrl: null,
    });
    expect(content.topLinks).toEqual([
      { shortUrl: "ishortn.ink/b", name: "Launch", clicks: 9 },
      { shortUrl: "ishortn.ink/a", name: null, clicks: 2 },
    ]);
  });

  test("a link report has no top links", () => {
    const content = buildScheduledReportContent({
      ...base,
      targetType: "link",
      targetName: "ishortn.ink/b",
      statsUrl: "https://ishortn.ink/stats/abc",
      links: [links[1]!],
    });
    expect(content.topLinks).toEqual([]);
    expect(content.clicks).toBe(9);
    expect(content.statsUrl).toBe("https://ishortn.ink/stats/abc");
  });

  test("merges breakdowns across links the way the analytics pages do", () => {
    const content = buildScheduledReportContent({
      ...base,
      targetType: "campaign",
      targetName: "Spring",
      links,
      countries: [
        { country: "Ghana", clicks: 3 },
        { country: "Unknown", clicks: 8 },
        { country: null, clicks: 1 },
        { country: "Kenya", clicks: 2 },
        { country: "Ghana", clicks: 2 },
      ],
      devices: [
        { device: "mobile", clicks: 4 },
        { device: "Mobile", clicks: 3 },
        { device: "Desktop", clicks: 2 },
        { device: null, clicks: 5 },
      ],
      referrers: [
        { referer: "instagram.com", clicks: 3 },
        { referer: null, clicks: 2 },
        { referer: "direct", clicks: 2 },
        { referer: "https://www.instagram.com/p/1", clicks: 1 },
      ],
    });
    expect(content.countries).toEqual([
      { name: "Ghana", clicks: 5 },
      { name: "Kenya", clicks: 2 },
    ]);
    expect(content.devices).toEqual([
      { name: "Mobile", clicks: 7 },
      { name: "Desktop", clicks: 2 },
    ]);
    // null and "direct" are one Direct row; ties are ordered by name.
    expect(content.sources).toEqual([
      { name: "Direct", clicks: 4 },
      { name: "Instagram", clicks: 4 },
    ]);
  });

  test("keeps the top 5 of each breakdown", () => {
    const content = buildScheduledReportContent({
      ...base,
      targetType: "link",
      targetName: "ishortn.ink/b",
      links: [links[1]!],
      countries: ["A", "B", "C", "D", "E", "F"].map((country, index) => ({
        country,
        clicks: index + 1,
      })),
    });
    expect(content.countries.map((row) => row.name)).toEqual(["F", "E", "D", "C", "B"]);
  });
});

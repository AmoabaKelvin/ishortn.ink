import { describe, expect, test } from "bun:test";

import { buildSignupSeries, classifyChannel, summarizeSignupGroups } from "./utils";

import type { SignupGroup } from "./utils";

function group(overrides: Partial<SignupGroup>): SignupGroup {
  return {
    attributed: true,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    referrerHost: null,
    landingPath: "/",
    hasClickId: false,
    signups: 1,
    paid: 0,
    ...overrides,
  };
}

describe("classifyChannel", () => {
  test("paid by click ID or paid medium", () => {
    expect(classifyChannel(group({ hasClickId: true }))).toBe("paid");
    expect(classifyChannel(group({ utmSource: "google", utmMedium: "CPC" }))).toBe("paid");
    expect(classifyChannel(group({ utmMedium: "paid_social" }))).toBe("paid");
  });

  test("other UTMs are a campaign", () => {
    expect(classifyChannel(group({ utmSource: "test", utmMedium: "test" }))).toBe("campaign");
    expect(classifyChannel(group({ utmCampaign: "launch" }))).toBe("campaign");
  });

  test("referrers split into organic search and referral", () => {
    expect(classifyChannel(group({ referrerHost: "www.google.com" }))).toBe("organic");
    expect(classifyChannel(group({ referrerHost: "google.co.uk" }))).toBe("organic");
    expect(classifyChannel(group({ referrerHost: "search.brave.com" }))).toBe("organic");
    expect(classifyChannel(group({ referrerHost: "news.ycombinator.com" }))).toBe("referral");
  });

  test("direct when attributed without a source, unknown without a record", () => {
    expect(classifyChannel(group({}))).toBe("direct");
    expect(classifyChannel(group({ attributed: false, landingPath: null }))).toBe("unknown");
  });
});

describe("summarizeSignupGroups", () => {
  const groups = [
    group({ utmSource: "test", utmMedium: "test", utmCampaign: "test", signups: 2, paid: 1 }),
    group({ referrerHost: "www.reddit.com", landingPath: "/pricing", signups: 3 }),
    group({ referrerHost: "www.google.com", signups: 1, paid: 1 }),
    group({ signups: 4 }),
    group({ attributed: false, landingPath: null, signups: 5 }),
  ];
  const { totals, breakdowns } = summarizeSignupGroups(groups, 50);

  test("totals count every signup and the attributed share", () => {
    expect(totals).toEqual({ signups: 15, paid: 2, attributed: 10 });
  });

  test("rolls up channels, sorted by signups", () => {
    expect(breakdowns.channel).toEqual([
      { key: "unknown", signups: 5, paid: 0 },
      { key: "direct", signups: 4, paid: 0 },
      { key: "referral", signups: 3, paid: 0 },
      { key: "campaign", signups: 2, paid: 1 },
      { key: "organic", signups: 1, paid: 1 },
    ]);
  });

  test("source and medium fall back to the referrer domain", () => {
    expect(breakdowns.source.map((row) => row.key)).toEqual([
      "(not recorded)",
      "(direct)",
      "reddit.com",
      "test",
      "google.com",
    ]);
    expect(breakdowns.medium.find((row) => row.key === "referral")?.signups).toBe(3);
    expect(breakdowns.medium.find((row) => row.key === "organic")?.signups).toBe(1);
    expect(breakdowns.medium.find((row) => row.key === "(none)")?.signups).toBe(4);
  });

  test("campaign, referrer and landing page breakdowns", () => {
    expect(breakdowns.campaign.find((row) => row.key === "test")).toEqual({
      key: "test",
      signups: 2,
      paid: 1,
    });
    expect(breakdowns.campaign.find((row) => row.key === "(not set)")?.signups).toBe(8);
    expect(breakdowns.referrer.find((row) => row.key === "(direct)")?.signups).toBe(6);
    expect(breakdowns.landingPath.find((row) => row.key === "/pricing")?.signups).toBe(3);
  });

  test("caps each breakdown at the limit", () => {
    expect(summarizeSignupGroups(groups, 2).breakdowns.source).toHaveLength(2);
  });
});

describe("buildSignupSeries", () => {
  test("fills missing days and groups weeks from Monday", () => {
    // 2026-11-14 is a Saturday.
    const { daily, weekly } = buildSignupSeries(
      [
        { date: "2026-11-14", signups: 2, paid: 0 },
        { date: "2026-11-16", signups: 3, paid: 1 },
        { date: "2026-11-20", signups: 1, paid: 0 },
      ],
      new Date("2026-11-14T00:00:00Z"),
      new Date("2026-11-20T00:00:00Z"),
    );
    expect(daily).toHaveLength(7);
    expect(daily[1]).toEqual({ date: "2026-11-15", signups: 0, paid: 0 });
    expect(weekly).toEqual([
      { date: "2026-11-14", signups: 2, paid: 0 },
      { date: "2026-11-16", signups: 4, paid: 1 },
    ]);
  });
});

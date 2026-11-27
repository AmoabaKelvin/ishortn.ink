import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { inArray } from "drizzle-orm";

import { env } from "@/env.mjs";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

import {
  buildWeeklySummaryContent,
  eventUpgradeLine,
  isWeeklySummaryDue,
  sendWeeklySummaries,
  summaryWeek,
  summaryWeekStarting,
  weeklySummaryUpgrade,
  type WeeklySummaryCandidate,
} from "./weekly-summary";

import type { SendWeeklySummaryInput } from "./notifications/weekly-summary";

// Monday 23 Nov 2026, the first scheduled run.
const NOW = new Date("2026-11-23T09:00:00Z");
const WEEK = summaryWeek(NOW);

describe("summaryWeek", () => {
  test("is the Monday-Sunday week before the current one, in UTC", () => {
    expect(WEEK.key).toBe("2026-11-16");
    expect(WEEK.start.toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(WEEK.end.toISOString()).toBe("2026-11-23T00:00:00.000Z");
    expect(WEEK.previousStart.toISOString()).toBe("2026-11-09T00:00:00.000Z");
    expect(WEEK.label).toBe("November 16 – 22");
  });

  test("any time during a week picks the same previous week", () => {
    expect(summaryWeek(new Date("2026-11-23T00:00:00Z")).key).toBe("2026-11-16");
    expect(summaryWeek(new Date("2026-11-29T23:59:59Z")).key).toBe("2026-11-16");
    expect(summaryWeek(new Date("2026-11-30T00:00:00Z")).key).toBe("2026-11-23");
  });

  test("names both months when the week spans two", () => {
    expect(summaryWeek(new Date("2026-12-07T09:00:00Z")).label).toBe("November 30 – December 6");
  });

  test("an explicit week must start on a Monday", () => {
    expect(summaryWeekStarting("2026-11-16")?.end.toISOString()).toBe("2026-11-23T00:00:00.000Z");
    expect(summaryWeekStarting("2026-11-17")).toBeNull();
    expect(summaryWeekStarting("2026-13-01")).toBeNull();
    expect(summaryWeekStarting("16/11/2026")).toBeNull();
  });
});

const due: WeeklySummaryCandidate = {
  email: "ama@example.com",
  banned: false,
  restrictedAt: null,
  deletedAt: null,
  productEmailsEnabled: true,
  weeklySummaryEnabled: true,
  emailSuppressed: false,
  clicks: 5,
};

describe("isWeeklySummaryDue", () => {
  test("an account with at least 5 clicks and both settings on is due", () => {
    expect(isWeeklySummaryDue(due)).toBe(true);
    expect(isWeeklySummaryDue({ ...due, banned: null, clicks: 1_000 })).toBe(true);
  });

  test("under 5 clicks is not due", () => {
    expect(isWeeklySummaryDue({ ...due, clicks: 4 })).toBe(false);
  });

  test("either unsubscribe excludes the account", () => {
    expect(isWeeklySummaryDue({ ...due, weeklySummaryEnabled: false })).toBe(false);
    expect(isWeeklySummaryDue({ ...due, productEmailsEnabled: false })).toBe(false);
  });

  test("suppressed, banned, restricted, deleted and address-less accounts are not due", () => {
    expect(isWeeklySummaryDue({ ...due, emailSuppressed: true })).toBe(false);
    expect(isWeeklySummaryDue({ ...due, banned: true })).toBe(false);
    expect(isWeeklySummaryDue({ ...due, restrictedAt: NOW })).toBe(false);
    expect(isWeeklySummaryDue({ ...due, deletedAt: NOW })).toBe(false);
    expect(isWeeklySummaryDue({ ...due, email: null })).toBe(false);
  });
});

describe("eventUpgradeLine", () => {
  const free = {
    plan: "free" as const,
    createdAt: new Date("2026-01-05T00:00:00Z"),
    monthlyEventCount: 0,
    lastEventCountReset: new Date("2026-11-01T00:00:05Z"),
    droppedEventCount: 0,
    eventTrackingPausedAt: null,
  };
  const paused = {
    ...free,
    monthlyEventCount: 1_000,
    droppedEventCount: 42,
    eventTrackingPausedAt: new Date("2026-11-12T10:00:00Z"),
  };

  test("shows this month's dropped visits for a paused Free account", () => {
    expect(eventUpgradeLine(paused, NOW)).toEqual({ reason: "paused", count: 42 });
  });

  test("shows usage from 60% of the Free cap", () => {
    expect(eventUpgradeLine({ ...free, monthlyEventCount: 600 }, NOW)).toEqual({
      reason: "cap",
      count: 600,
    });
    expect(eventUpgradeLine({ ...free, monthlyEventCount: 599 }, NOW)).toBeNull();
    expect(eventUpgradeLine({ ...free, monthlyEventCount: 1_200 }, NOW)).toEqual({
      reason: "cap",
      count: 1_000,
    });
  });

  test("a count or pause from an earlier month is stale", () => {
    const lastMonth = new Date("2026-10-30T00:00:00Z");
    expect(
      eventUpgradeLine({ ...free, monthlyEventCount: 900, lastEventCountReset: lastMonth }, NOW),
    ).toBeNull();
    expect(
      eventUpgradeLine(
        { ...paused, eventTrackingPausedAt: lastMonth, lastEventCountReset: lastMonth },
        NOW,
      ),
    ).toBeNull();
  });

  test("never for paid plans", () => {
    expect(eventUpgradeLine({ ...paused, plan: "pro" }, NOW)).toBeNull();
    expect(eventUpgradeLine({ ...free, plan: "pro", monthlyEventCount: 900 }, NOW)).toBeNull();
    expect(eventUpgradeLine({ ...free, plan: "ultra", monthlyEventCount: 900 }, NOW)).toBeNull();
  });
});

describe("weeklySummaryUpgrade", () => {
  test("the event-cap line wins, then hidden history, else no line", () => {
    const cap = { reason: "cap" as const, count: 700 };
    expect(weeklySummaryUpgrade(cap, 12)).toEqual(cap);
    expect(weeklySummaryUpgrade(null, 12)).toEqual({ reason: "history", count: 12 });
    expect(weeklySummaryUpgrade(null, 0)).toBeNull();
  });
});

describe("buildWeeklySummaryContent", () => {
  const links = [
    { domain: "ishortn.ink", alias: "a", name: null, clicks: 2 },
    { domain: "ishortn.ink", alias: "b", name: "Launch", clicks: 9 },
    { domain: "go.acme.com", alias: "c", name: null, clicks: 4 },
    { domain: "ishortn.ink", alias: "d", name: null, clicks: 4 },
  ];

  test("keeps the top 3 links by clicks, ties by short URL", () => {
    const content = buildWeeklySummaryContent({
      week: WEEK,
      clicks: 19,
      previousClicks: 7,
      links,
      countries: [],
      referrers: [],
      upgrade: null,
    });
    expect(content.topLinks).toEqual([
      { shortUrl: "ishortn.ink/b", name: "Launch", clicks: 9 },
      { shortUrl: "go.acme.com/c", name: null, clicks: 4 },
      { shortUrl: "ishortn.ink/d", name: null, clicks: 4 },
    ]);
    expect(content).toMatchObject({
      weekLabel: "November 16 – 22",
      clicks: 19,
      previousClicks: 7,
      topCountry: null,
      topSource: null,
      upgrade: null,
    });
  });

  test("ignores unresolved countries", () => {
    const content = buildWeeklySummaryContent({
      week: WEEK,
      clicks: 10,
      previousClicks: 0,
      links,
      countries: [
        { country: "Unknown", clicks: 6 },
        { country: null, clicks: 1 },
        { country: "Ghana", clicks: 2 },
        { country: "Kenya", clicks: 1 },
      ],
      referrers: [],
      upgrade: { reason: "history", count: 3 },
    });
    expect(content.topCountry).toEqual({ name: "Ghana", clicks: 2 });
    expect(content.upgrade).toEqual({ reason: "history", count: 3 });
  });

  test("groups sources the way the analytics pages do", () => {
    const content = buildWeeklySummaryContent({
      week: WEEK,
      clicks: 10,
      previousClicks: 0,
      links,
      countries: [],
      referrers: [
        { referer: "instagram.com", clicks: 3 },
        { referer: null, clicks: 2 },
        { referer: "null", clicks: 1 },
        { referer: "direct", clicks: 2 },
        { referer: "https://www.instagram.com/p/123", clicks: 1 },
      ],
      upgrade: null,
    });
    // null, "null" and "direct" are one Direct row (5) and beat instagram.com (4).
    expect(content.topSource).toEqual({ name: "Direct", clicks: 5 });
  });
});

// Runs against a disposable MySQL with the schema pushed; see CONTRIBUTING.md, "Database tests".
// Sends go through a recorder, so no email leaves the test.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("weekly summary job (MySQL)", () => {
  const PREFIX = "wks_test_";
  const ACTIVE = `${PREFIX}active`;
  const FEW = `${PREFIX}few`;
  const WEEKLY_OFF = `${PREFIX}weekly_off`;
  const PRODUCT_OFF = `${PREFIX}product_off`;
  const BOUNCED = `${PREFIX}bounced`;
  const TEAM_ONLY = `${PREFIX}team_only`;
  const PRO = `${PREFIX}pro`;
  const USERS = [ACTIVE, FEW, WEEKLY_OFF, PRODUCT_OFF, BOUNCED, TEAM_ONLY, PRO];
  const emailOf = (id: string) => `${id}@weekly-summary.test`;

  const inWeek = new Date("2026-11-18T12:00:00Z");
  const previousWeek = new Date("2026-11-11T12:00:00Z");

  let sent: SendWeeklySummaryInput[] = [];
  const record = async (input: SendWeeklySummaryInput) => {
    sent.push(input);
    return true;
  };
  const run = (options: Parameters<typeof sendWeeklySummaries>[0] = {}) =>
    sendWeeklySummaries({ now: NOW, send: record, sendIntervalMs: 0, ...options });

  beforeAll(() => {
    if (!env.DATABASE_URL) Object.assign(env, { DATABASE_URL: testDatabaseUrl });
  });

  async function cleanup() {
    const links = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, USERS));
    if (links.length) {
      await db.delete(schema.linkVisit).where(
        inArray(
          schema.linkVisit.linkId,
          links.map((row) => row.id),
        ),
      );
    }
    await db.delete(schema.link).where(inArray(schema.link.userId, USERS));
    await db
      .delete(schema.weeklySummaryEmail)
      .where(inArray(schema.weeklySummaryEmail.userId, USERS));
    await db.delete(schema.emailSuppression).where(inArray(schema.emailSuppression.userId, USERS));
    await db.delete(schema.user).where(inArray(schema.user.id, USERS));
  }

  async function addLink(userId: string, alias: string, teamId: number | null = null) {
    const [result] = await db.insert(schema.link).values({
      url: "https://example.com",
      alias: `${PREFIX}${alias}`,
      name: alias === "a1" ? "Launch post" : null,
      userId,
      teamId,
    });
    return result.insertId;
  }

  async function addVisits(
    linkId: number,
    total: number,
    createdAt: Date,
    visit: { country?: string; referer?: string } = {},
  ) {
    await db
      .insert(schema.linkVisit)
      .values(Array.from({ length: total }, () => ({ linkId, createdAt, ...visit })));
  }

  beforeEach(async () => {
    await cleanup();
    sent = [];
    await db.insert(schema.user).values(
      USERS.map((id) => ({
        id,
        email: emailOf(id),
        name: "Ama Mensah",
        productEmailsEnabled: id !== PRODUCT_OFF,
        weeklySummaryEnabled: id !== WEEKLY_OFF,
        droppedEventCount: id === ACTIVE ? 42 : 0,
        eventTrackingPausedAt: id === ACTIVE ? new Date("2026-11-12T10:00:00Z") : null,
      })),
    );

    const a1 = await addLink(ACTIVE, "a1");
    const a2 = await addLink(ACTIVE, "a2");
    await addVisits(a1, 5, inWeek, { country: "Ghana", referer: "instagram.com" });
    await addVisits(a2, 3, inWeek, { country: "Kenya", referer: "direct" });
    // Edges: the first instant of the week counts, the first instant of this week doesn't.
    await addVisits(a2, 1, WEEK.start, { country: "Kenya", referer: "direct" });
    await addVisits(a2, 4, WEEK.end, { country: "Kenya", referer: "direct" });
    await addVisits(a1, 3, previousWeek);

    await addVisits(await addLink(FEW, "f1"), 4, inWeek);
    await addVisits(await addLink(WEEKLY_OFF, "w1"), 6, inWeek);
    await addVisits(await addLink(PRODUCT_OFF, "p1"), 6, inWeek);
    await addVisits(await addLink(BOUNCED, "b1"), 6, inWeek);
    await addVisits(await addLink(TEAM_ONLY, "t1", 999_999), 9, inWeek);
    await addVisits(await addLink(PRO, "r1"), 5, inWeek, { country: "Unknown" });

    await db.insert(schema.emailSuppression).values({
      email: emailOf(BOUNCED),
      type: "bounced",
      userId: BOUNCED,
      lastEventAt: NOW,
    });
  });

  afterAll(cleanup);

  test("emails only accounts with 5+ personal clicks that haven't opted out", async () => {
    const result = await run();

    expect(sent.map((item) => item.userId).sort()).toEqual([ACTIVE, PRO].sort());
    expect(result).toMatchObject({ week: "2026-11-16", sent: 2, failed: 0 });
  });

  test("builds the content from the week's clicks", async () => {
    await run();
    const active = sent.find((item) => item.userId === ACTIVE);

    expect(active?.email).toBe(emailOf(ACTIVE));
    expect(active?.content).toEqual({
      weekLabel: "November 16 – 22",
      clicks: 9,
      previousClicks: 3,
      topLinks: [
        { shortUrl: `ishortn.ink/${PREFIX}a1`, name: "Launch post", clicks: 5 },
        { shortUrl: `ishortn.ink/${PREFIX}a2`, name: null, clicks: 4 },
      ],
      topCountry: { name: "Ghana", clicks: 5 },
      topSource: { name: "instagram.com", clicks: 5 },
      upgrade: { reason: "paused", count: 42 },
    });
    expect(sent.find((item) => item.userId === PRO)?.content.topCountry).toBeNull();
  });

  test("a Free account without a cap line gets its hidden older clicks, else no line", async () => {
    const upgradeOf = async () =>
      (await run({ dryRun: true })).previews.find((item) => item.userId === PRO)?.content.upgrade;
    expect(await upgradeOf()).toBeNull();

    const [{ id: proLink }] = await db
      .select({ id: schema.link.id })
      .from(schema.link)
      .where(inArray(schema.link.userId, [PRO]));
    // Before the Free window (17 Nov for a 23 Nov run): raw visits plus an archived day.
    await addVisits(proLink, 2, previousWeek);
    await db
      .insert(schema.linkVisitDailySummary)
      .values({ linkId: proLink, date: "2026-09-01", clicks: 10, uniqueClicks: 4 });
    try {
      expect(await upgradeOf()).toEqual({ reason: "history", count: 12 });

      await db
        .update(schema.user)
        .set({ monthlyEventCount: 700, lastEventCountReset: new Date("2026-11-01T00:00:00Z") })
        .where(inArray(schema.user.id, [PRO]));
      expect(await upgradeOf()).toEqual({ reason: "cap", count: 700 });
    } finally {
      await db
        .delete(schema.linkVisitDailySummary)
        .where(inArray(schema.linkVisitDailySummary.linkId, [proLink]));
    }
  });

  test("a dry run lists the recipients without claiming or sending", async () => {
    const preview = await run({ dryRun: true });

    expect(sent).toEqual([]);
    expect(preview.previews.map((item) => item.userId).sort()).toEqual([ACTIVE, PRO].sort());
    expect(
      await db
        .select()
        .from(schema.weeklySummaryEmail)
        .where(inArray(schema.weeklySummaryEmail.userId, USERS)),
    ).toEqual([]);
  });

  test("re-running the same week sends nothing new and logs each send", async () => {
    await run();
    const second = await run({ now: new Date(NOW.getTime() + 60 * 60 * 1000) });

    expect(sent).toHaveLength(2);
    expect(second).toMatchObject({ sent: 0, alreadySent: 2 });

    const rows = await db
      .select()
      .from(schema.weeklySummaryEmail)
      .where(inArray(schema.weeklySummaryEmail.userId, USERS));
    expect(rows.map((row) => [row.userId, row.weekStart, row.clicks]).sort()).toEqual(
      [
        [ACTIVE, "2026-11-16", 9],
        [PRO, "2026-11-16", 5],
      ].sort(),
    );
    expect(rows.every((row) => row.sentAt !== null)).toBe(true);
  });

  test("a rejected send is retried on the next run", async () => {
    const reject = async (input: SendWeeklySummaryInput) => {
      sent.push(input);
      return false;
    };

    expect(await run({ send: reject })).toMatchObject({ sent: 0, failed: 2 });
    expect(await run()).toMatchObject({ sent: 2, failed: 0 });
    expect(await run()).toMatchObject({ sent: 0 });
    expect(sent).toHaveLength(4);
  });

  test("a run stops at the send cap and the next run picks up the rest", async () => {
    expect(await run({ maxSends: 1 })).toMatchObject({ sent: 1 });
    expect(await run({ maxSends: 1 })).toMatchObject({ sent: 1, alreadySent: 1 });
    expect(await run({ maxSends: 1 })).toMatchObject({ sent: 0, alreadySent: 2 });
    expect(sent.map((item) => item.userId).sort()).toEqual([ACTIVE, PRO].sort());
  });
});

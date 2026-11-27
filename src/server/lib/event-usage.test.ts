import { afterAll, describe, expect, test } from "bun:test";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

import { getPlanCaps } from "@/lib/billing/plans";
import * as schema from "@/server/db/schema";

import { allocateEventQuota, getEventTrackingPause, reserveEventUsage } from "./event-usage";
import { usageMonth } from "./user-plan";

const FREE_EVENTS_LIMIT = getPlanCaps("free").eventsLimit ?? 0;

describe("usageMonth", () => {
  test("formats the calendar month as YYYY-MM", () => {
    expect(usageMonth(new Date(2026, 10, 30, 23, 59))).toBe("2026-11");
    expect(usageMonth(new Date(2026, 0, 1))).toBe("2026-01");
  });
});

describe("allocateEventQuota", () => {
  test("grants the whole batch when it fits", () => {
    expect(
      allocateEventQuota({ currentCount: 10, limit: 1000, requested: 5, previousAlertLevel: 0 }),
    ).toEqual({ allowed: 5, dropped: 0, newCount: 15, alertLevel: null });
  });

  test("grants only what remains when the batch crosses the cap", () => {
    expect(
      allocateEventQuota({ currentCount: 997, limit: 1000, requested: 10, previousAlertLevel: 90 }),
    ).toEqual({ allowed: 3, dropped: 7, newCount: 1000, alertLevel: 100 });
  });

  test("grants nothing at or past the cap", () => {
    expect(
      allocateEventQuota({
        currentCount: 1000,
        limit: 1000,
        requested: 1,
        previousAlertLevel: 100,
      }),
    ).toEqual({ allowed: 0, dropped: 1, newCount: 1000, alertLevel: null });
    expect(
      allocateEventQuota({
        currentCount: 1200,
        limit: 1000,
        requested: 1,
        previousAlertLevel: 100,
      }),
    ).toEqual({ allowed: 0, dropped: 1, newCount: 1200, alertLevel: null });
  });

  test("still raises the 100% alert when a capped owner has not been told", () => {
    expect(
      allocateEventQuota({ currentCount: 1000, limit: 1000, requested: 4, previousAlertLevel: 90 }),
    ).toEqual({ allowed: 0, dropped: 4, newCount: 1000, alertLevel: 100 });
  });

  test("fires the first crossed threshold once", () => {
    expect(
      allocateEventQuota({ currentCount: 790, limit: 1000, requested: 20, previousAlertLevel: 0 }),
    ).toEqual({ allowed: 20, dropped: 0, newCount: 810, alertLevel: 80 });
    expect(
      allocateEventQuota({ currentCount: 810, limit: 1000, requested: 1, previousAlertLevel: 80 }),
    ).toEqual({ allowed: 1, dropped: 0, newCount: 811, alertLevel: null });
  });
});

describe("getEventTrackingPause", () => {
  const pausedAt = new Date(2026, 10, 14, 9, 30);
  const now = new Date(2026, 10, 20, 12, 0);

  test("reports dropped events and the next month start once over the cap", () => {
    expect(
      getEventTrackingPause({ count: 1000, limit: 1000, dropped: 312, pausedAt, now }),
    ).toEqual({ dropped: 312, pausedAt, resetsAt: new Date(2026, 11, 1) });
  });

  test("rolls the reset date over the year boundary", () => {
    expect(
      getEventTrackingPause({
        count: 1000,
        limit: 1000,
        dropped: 1,
        pausedAt,
        now: new Date(2026, 11, 31, 23, 0),
      })?.resetsAt,
    ).toEqual(new Date(2027, 0, 1));
  });

  test("is not paused when nothing was dropped or there is no pause date", () => {
    expect(getEventTrackingPause({ count: 1000, limit: 1000, dropped: 0, pausedAt, now })).toBe(
      null,
    );
    expect(
      getEventTrackingPause({ count: 1000, limit: 1000, dropped: 5, pausedAt: null, now }),
    ).toBe(null);
  });

  test("is not paused after a reset or an upgrade lifts the count under the cap", () => {
    expect(getEventTrackingPause({ count: 0, limit: 1000, dropped: 312, pausedAt, now })).toBe(
      null,
    );
    expect(getEventTrackingPause({ count: 1000, limit: 10000, dropped: 312, pausedAt, now })).toBe(
      null,
    );
  });

  test("is never paused without a limit", () => {
    expect(getEventTrackingPause({ count: 50000, limit: null, dropped: 3, pausedAt, now })).toBe(
      null,
    );
  });
});

// The snapshot-then-reset runs under a row lock in MySQL. Set TEST_DATABASE_URL to run these; see
// CONTRIBUTING.md, "Database tests".
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("monthly event reset (MySQL)", () => {
  const pool = mysql.createPool({ uri: testDatabaseUrl ?? "", connectionLimit: 10 });
  const db = drizzle(pool, { schema, mode: "default" });
  const USER_ID = "event_usage_test_snapshot";
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

  async function seedUser(usage: {
    monthlyEventCount: number;
    droppedEventCount: number;
    lastEventCountReset: Date;
  }) {
    await db
      .delete(schema.monthlyUsageSnapshot)
      .where(eq(schema.monthlyUsageSnapshot.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await db.insert(schema.user).values({
      id: USER_ID,
      ...usage,
      eventUsageAlertLevel: usage.monthlyEventCount >= FREE_EVENTS_LIMIT ? 100 : 0,
      eventTrackingPausedAt: usage.droppedEventCount > 0 ? usage.lastEventCountReset : null,
      productEmailsEnabled: false,
    });
  }

  // Mirrors click ingest: the owner's batch is charged inside one transaction.
  const recordVisits = (count: number) =>
    db.transaction((tx) => reserveEventUsage(USER_ID, count, tx));

  const storedUser = () => db.query.user.findFirst({ where: eq(schema.user.id, USER_ID) });
  const snapshots = () =>
    db
      .select()
      .from(schema.monthlyUsageSnapshot)
      .where(eq(schema.monthlyUsageSnapshot.userId, USER_ID));

  afterAll(async () => {
    await db
      .delete(schema.monthlyUsageSnapshot)
      .where(eq(schema.monthlyUsageSnapshot.userId, USER_ID));
    await db.delete(schema.user).where(eq(schema.user.id, USER_ID));
    await pool.end();
  });

  test("snapshots last month's recorded and dropped visits before zeroing the counters", async () => {
    await seedUser({
      monthlyEventCount: FREE_EVENTS_LIMIT,
      droppedEventCount: 2137,
      lastEventCountReset: lastMonth,
    });

    expect(await recordVisits(3)).toMatchObject({ allowed: 3 });

    expect(await snapshots()).toMatchObject([
      {
        month: usageMonth(lastMonth),
        recordedEventCount: FREE_EVENTS_LIMIT,
        droppedEventCount: 2137,
      },
    ]);
    expect(await storedUser()).toMatchObject({
      monthlyEventCount: 3,
      droppedEventCount: 0,
      eventUsageAlertLevel: 0,
      eventTrackingPausedAt: null,
    });
  });

  test("concurrent first batches of a new month write one snapshot and keep every visit", async () => {
    await seedUser({
      monthlyEventCount: 640,
      droppedEventCount: 0,
      lastEventCountReset: lastMonth,
    });

    await Promise.all(Array.from({ length: 6 }, () => recordVisits(2)));

    expect(await snapshots()).toMatchObject([{ recordedEventCount: 640, droppedEventCount: 0 }]);
    expect((await storedUser())?.monthlyEventCount).toBe(12);
  });

  test("writes no snapshot for a month without usage", async () => {
    await seedUser({ monthlyEventCount: 0, droppedEventCount: 0, lastEventCountReset: lastMonth });

    await recordVisits(1);

    expect(await snapshots()).toEqual([]);
    expect((await storedUser())?.monthlyEventCount).toBe(1);
  });

  test("leaves the current month's counters alone", async () => {
    await seedUser({ monthlyEventCount: 10, droppedEventCount: 0, lastEventCountReset: now });

    await recordVisits(1);

    expect(await snapshots()).toEqual([]);
    expect((await storedUser())?.monthlyEventCount).toBe(11);
  });
});

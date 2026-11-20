import { describe, expect, test } from "bun:test";

import { allocateEventQuota, getEventTrackingPause } from "./event-usage";

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

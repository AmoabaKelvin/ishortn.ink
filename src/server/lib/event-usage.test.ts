import { describe, expect, test } from "bun:test";

import { allocateEventQuota } from "./event-usage";

describe("allocateEventQuota", () => {
  test("grants the whole batch when it fits", () => {
    expect(
      allocateEventQuota({ currentCount: 10, limit: 1000, requested: 5, previousAlertLevel: 0 }),
    ).toEqual({ allowed: 5, newCount: 15, alertLevel: null });
  });

  test("grants only what remains when the batch crosses the cap", () => {
    expect(
      allocateEventQuota({ currentCount: 997, limit: 1000, requested: 10, previousAlertLevel: 90 }),
    ).toEqual({ allowed: 3, newCount: 1000, alertLevel: 100 });
  });

  test("grants nothing at or past the cap", () => {
    expect(
      allocateEventQuota({ currentCount: 1000, limit: 1000, requested: 1, previousAlertLevel: 100 }),
    ).toEqual({ allowed: 0, newCount: 1000, alertLevel: null });
    expect(
      allocateEventQuota({ currentCount: 1200, limit: 1000, requested: 1, previousAlertLevel: 100 }),
    ).toEqual({ allowed: 0, newCount: 1200, alertLevel: null });
  });

  test("still raises the 100% alert when a capped owner has not been told", () => {
    expect(
      allocateEventQuota({ currentCount: 1000, limit: 1000, requested: 4, previousAlertLevel: 90 }),
    ).toEqual({ allowed: 0, newCount: 1000, alertLevel: 100 });
  });

  test("fires the first crossed threshold once", () => {
    expect(
      allocateEventQuota({ currentCount: 790, limit: 1000, requested: 20, previousAlertLevel: 0 }),
    ).toEqual({ allowed: 20, newCount: 810, alertLevel: 80 });
    expect(
      allocateEventQuota({ currentCount: 810, limit: 1000, requested: 1, previousAlertLevel: 80 }),
    ).toEqual({ allowed: 1, newCount: 811, alertLevel: null });
  });
});

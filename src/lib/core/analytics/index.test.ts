import { describe, expect, test } from "bun:test";

import { analyticsWindow } from ".";

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

import { describe, expect, test } from "bun:test";

import { countsTowardMonthlyLinkQuota } from "./utils";

describe("monthly link quota", () => {
  test("regular short links and QR tracking links count toward the quota on every plan", () => {
    for (const plan of ["free", "pro", "ultra"] as const) {
      expect(countsTowardMonthlyLinkQuota(plan, {})).toBe(true);
      expect(countsTowardMonthlyLinkQuota(plan, { isBioLink: false })).toBe(true);
      expect(countsTowardMonthlyLinkQuota(plan, { isBioLink: null })).toBe(true);
    }
  });

  test("free bio link blocks don't count toward the quota", () => {
    expect(countsTowardMonthlyLinkQuota("free", { isBioLink: true })).toBe(false);
  });

  test("paid bio link blocks still count toward the quota", () => {
    expect(countsTowardMonthlyLinkQuota("pro", { isBioLink: true })).toBe(true);
    expect(countsTowardMonthlyLinkQuota("ultra", { isBioLink: true })).toBe(true);
  });
});

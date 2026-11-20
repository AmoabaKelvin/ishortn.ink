import { describe, expect, test } from "bun:test";

import { countsTowardMonthlyLinkQuota } from "./utils";

describe("monthly link quota", () => {
  test("regular short links and QR tracking links count toward the quota", () => {
    expect(countsTowardMonthlyLinkQuota({})).toBe(true);
    expect(countsTowardMonthlyLinkQuota({ isBioLink: false })).toBe(true);
    expect(countsTowardMonthlyLinkQuota({ isBioLink: null })).toBe(true);
  });

  test("bio link blocks don't count toward the quota", () => {
    expect(countsTowardMonthlyLinkQuota({ isBioLink: true })).toBe(false);
  });
});

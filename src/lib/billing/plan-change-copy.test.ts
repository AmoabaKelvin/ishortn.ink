import { describe, expect, test } from "bun:test";

import { buildPlanChangeCopy, formatMinorUnits } from "./plan-change-copy";

describe("formatMinorUnits", () => {
  test("formats the lowest denomination in the currency", () => {
    expect(formatMinorUnits(609, "USD")).toBe("$6.09");
    expect(formatMinorUnits(8000, "USD")).toBe("$80.00");
    expect(formatMinorUnits(123456, "USD")).toBe("$1,234.56");
    expect(formatMinorUnits(1200, "EUR")).toBe("€12.00");
    // Yen has no minor unit.
    expect(formatMinorUnits(1200, "JPY")).toBe("¥1,200");
  });
});

describe("buildPlanChangeCopy", () => {
  const amountDue = (amount: number) => ({
    type: "amount_due" as const,
    amount,
    currencyCode: "USD",
  });

  test("an upgrade quotes Paddle's amount due today, not the list price", () => {
    const copy = buildPlanChangeCopy("upgrade", "ultra", "monthly", amountDue(609));
    expect(copy.description).toBe(
      "You'll be charged $6.09 today for Ultra monthly, after credit for the unused time on your current plan.",
    );
    expect(copy.description).not.toContain("$15");
  });

  test("a switch to annual quotes the amount due today", () => {
    const copy = buildPlanChangeCopy("switch", "pro", "annual", amountDue(7412));
    expect(copy.description).toBe(
      "You'll be charged $74.12 today, after credit for the unused part of your current month.",
    );
    expect(copy.note).toBe("That's 2 months free compared to paying monthly.");
  });

  test("a failed preview falls back to prorated wording without a price", () => {
    const upgrade = buildPlanChangeCopy("upgrade", "ultra", "annual", { type: "prorated" });
    expect(upgrade.description).toBe(
      "You'll be charged a prorated amount today for Ultra annual, after credit for the unused time on your current plan.",
    );
    const annual = buildPlanChangeCopy("switch", "pro", "annual", { type: "prorated" });
    expect(annual.description).not.toContain("$");
  });

  test("a charge fully covered by credit says nothing is due", () => {
    expect(buildPlanChangeCopy("switch", "pro", "annual", amountDue(0)).description).toBe(
      "Nothing is due today: your account credit covers the annual charge.",
    );
    expect(buildPlanChangeCopy("upgrade", "ultra", "monthly", amountDue(0)).description).toContain(
      "Nothing is due today",
    );
  });

  test("a switch to monthly mentions a charge only when one is due", () => {
    expect(buildPlanChangeCopy("switch", "pro", "monthly", amountDue(0)).description).toBe(
      "You'll move to $8/month. Any unused time on your annual plan is credited to your account.",
    );
    expect(buildPlanChangeCopy("switch", "pro", "monthly", amountDue(250)).description).toBe(
      "You'll be charged $2.50 today and move to $8/month.",
    );
  });

  test("without a preview (Lemon Squeezy) the list price is quoted", () => {
    expect(buildPlanChangeCopy("upgrade", "ultra", "monthly").description).toBe(
      "You'll be charged $15 today for Ultra monthly, with credit for the unused time on your current plan.",
    );
    expect(buildPlanChangeCopy("switch", "pro", "annual").description).toContain("$80 today");
  });
});

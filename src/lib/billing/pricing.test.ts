import { describe, expect, test } from "bun:test";

import { formatUsd, planPriceDisplay, planSignupHref, resolveBillingInterval } from "./pricing";
import { ACTIVE_PROMO } from "./promo";

describe("resolveBillingInterval", () => {
  test("defaults to annual without a param", () => {
    expect(resolveBillingInterval(null)).toBe("annual");
    expect(resolveBillingInterval(undefined)).toBe("annual");
    expect(resolveBillingInterval("weekly")).toBe("annual");
  });

  test("honours an explicit interval param", () => {
    expect(resolveBillingInterval("monthly")).toBe("monthly");
    expect(resolveBillingInterval("annual", "pro", "monthly")).toBe("annual");
    expect(resolveBillingInterval(new URLSearchParams("interval=monthly").get("interval"))).toBe(
      "monthly",
    );
  });

  test("free accounts default to annual, subscribers to their current interval", () => {
    expect(resolveBillingInterval(null, "free", "monthly")).toBe("annual");
    expect(resolveBillingInterval(null, "pro", "monthly")).toBe("monthly");
    expect(resolveBillingInterval(null, "ultra", "annual")).toBe("annual");
  });
});

describe("formatUsd", () => {
  test("drops cents on whole dollars and pads fractional ones", () => {
    expect(formatUsd(8)).toBe("8");
    expect(formatUsd(80 / 12)).toBe("6.67");
    expect(formatUsd(150 / 12)).toBe("12.50");
    expect(formatUsd(0)).toBe("0");
  });
});

describe("planPriceDisplay", () => {
  test("annual shows the per-month equivalent and the yearly charge", () => {
    expect(planPriceDisplay("pro", "annual")).toEqual({
      perMonth: "6.67",
      compareAt: "8",
      note: "billed $80 yearly",
    });
    expect(planPriceDisplay("ultra", "annual")).toEqual({
      perMonth: "12.50",
      compareAt: "15",
      note: "billed $150 yearly",
    });
  });

  test("monthly shows the list price", () => {
    expect(planPriceDisplay("pro", "monthly")).toEqual({
      perMonth: "8",
      compareAt: null,
      note: "billed monthly",
    });
  });

  test("free is the same on both intervals", () => {
    expect(planPriceDisplay("free", "annual")).toEqual(planPriceDisplay("free", "monthly"));
    expect(planPriceDisplay("free", "annual").perMonth).toBe("0");
  });

  test("a promo discounts the first year against the same interval's list price", () => {
    expect(planPriceDisplay("pro", "monthly", ACTIVE_PROMO)).toEqual({
      perMonth: "6.40",
      compareAt: "8",
      note: "for 12 months, then $8/mo",
    });
    expect(planPriceDisplay("ultra", "monthly", ACTIVE_PROMO)).toEqual({
      perMonth: "12",
      compareAt: "15",
      note: "for 12 months, then $15/mo",
    });
    expect(planPriceDisplay("pro", "annual", ACTIVE_PROMO)).toEqual({
      perMonth: "5.33",
      compareAt: "6.67",
      note: "billed $64 first year, then $80/yr",
    });
    expect(planPriceDisplay("ultra", "annual", ACTIVE_PROMO)).toEqual({
      perMonth: "10",
      compareAt: "12.50",
      note: "billed $120 first year, then $150/yr",
    });
  });

  test("a promo leaves free unchanged", () => {
    expect(planPriceDisplay("free", "annual", ACTIVE_PROMO)).toEqual(
      planPriceDisplay("free", "annual"),
    );
  });
});

describe("planSignupHref", () => {
  test("carries the selected interval through sign-up", () => {
    const annual = new URL(planSignupHref("pro", "annual"), "https://ishortn.ink");
    expect(annual.pathname).toBe("/auth/sign-up");
    expect(annual.searchParams.get("next")).toBe("/dashboard/pricing?plan=pro&interval=annual");

    const monthly = new URL(planSignupHref("ultra", "monthly"), "https://ishortn.ink");
    expect(monthly.searchParams.get("next")).toBe("/dashboard/pricing?plan=ultra&interval=monthly");
  });

  test("carries the visit's source and UTM tags to the checkout after sign-up", () => {
    const href = planSignupHref("pro", "annual", { utm_source: "browser-extension" });
    expect(new URL(href, "https://ishortn.ink").searchParams.get("next")).toBe(
      "/dashboard/pricing?plan=pro&interval=annual&utm_source=browser-extension",
    );
  });
});

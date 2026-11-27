import { describe, expect, test } from "bun:test";

import {
  formatUsd,
  planPriceDisplay,
  planSignupHref,
  resolveBillingInterval,
  subscribedPriceDisplay,
  subscriptionDiscount,
} from "./pricing";
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

describe("subscriptionDiscount", () => {
  const checkout = {
    plan: "pro" as const,
    interval: "monthly" as const,
    promoCode: ACTIVE_PROMO.code,
    provider: "lemonsqueezy",
    createdAt: new Date("2026-11-25T12:00:00Z"),
  };
  const subscription = {
    plan: "pro" as const,
    interval: "monthly" as const,
    provider: "lemonsqueezy",
  };
  const now = new Date("2026-12-10T00:00:00Z");

  test("a known promo code gives its percent until 12 months after checkout", () => {
    expect(subscriptionDiscount(checkout, subscription, now)).toEqual({
      code: ACTIVE_PROMO.code,
      percentOff: ACTIVE_PROMO.percentOff,
      endsAt: new Date("2027-11-25T12:00:00Z"),
    });
    expect(
      subscriptionDiscount(checkout, subscription, new Date("2027-11-25T12:00:00Z")),
    ).toBeNull();
  });

  test("an unknown code is still a discount, without a percent", () => {
    expect(
      subscriptionDiscount({ ...checkout, promoCode: "PARTNER10" }, subscription, now),
    ).toMatchObject({ code: "PARTNER10", percentOff: null });
  });

  test("no code, or a plan, interval or provider other than the checkout's, is no discount", () => {
    expect(subscriptionDiscount(null, subscription, now)).toBeNull();
    expect(subscriptionDiscount({ ...checkout, promoCode: null }, subscription, now)).toBeNull();
    expect(subscriptionDiscount(checkout, { ...subscription, plan: "ultra" }, now)).toBeNull();
    expect(subscriptionDiscount(checkout, { ...subscription, interval: "annual" }, now)).toBeNull();
    expect(subscriptionDiscount(checkout, { ...subscription, provider: "paddle" }, now)).toBeNull();
  });

  describe("on Paddle, after plan and interval changes", () => {
    const paddleCheckout = { ...checkout, provider: "paddle" };
    const startedAt = new Date("2026-11-25T12:05:00Z");
    const firstYearEnd = new Date("2027-11-25T12:05:00Z");

    test("a monthly Pro/Ultra switch keeps the discount to the end of the first year", () => {
      expect(
        subscriptionDiscount(
          paddleCheckout,
          {
            plan: "ultra",
            interval: "monthly",
            provider: "paddle",
            startedAt,
            periodEndsAt: new Date("2027-01-25T12:05:00Z"),
          },
          now,
        ),
      ).toEqual({
        code: ACTIVE_PROMO.code,
        percentOff: ACTIVE_PROMO.percentOff,
        endsAt: firstYearEnd,
      });
    });

    test("monthly to annual shows the discounted annual period, then nothing", () => {
      const periodEndsAt = new Date("2028-03-01T00:00:00Z");
      const annual = {
        plan: "pro" as const,
        interval: "annual" as const,
        provider: "paddle",
        startedAt,
        periodEndsAt,
      };
      expect(
        subscriptionDiscount(paddleCheckout, annual, new Date("2027-03-01T00:00:00Z")),
      ).toMatchObject({ endsAt: periodEndsAt });
      expect(
        subscriptionDiscount(
          paddleCheckout,
          { ...annual, periodEndsAt: new Date("2029-03-01T00:00:00Z") },
          new Date("2028-03-02T00:00:00Z"),
        ),
      ).toBeNull();
    });

    test("after the first year nothing is shown", () => {
      expect(
        subscriptionDiscount(
          paddleCheckout,
          {
            plan: "ultra",
            interval: "monthly",
            provider: "paddle",
            startedAt,
            periodEndsAt: new Date("2027-12-25T12:05:00Z"),
          },
          new Date("2027-11-26T00:00:00Z"),
        ),
      ).toBeNull();
    });
  });
});

describe("subscribedPriceDisplay", () => {
  const endsAt = new Date("2027-11-25T12:00:00Z");

  test("without a discount it is the list price", () => {
    expect(subscribedPriceDisplay("pro", "monthly", null)).toEqual(
      planPriceDisplay("pro", "monthly"),
    );
  });

  test("a monthly discount shows the billed amount and when it ends", () => {
    expect(
      subscribedPriceDisplay("pro", "monthly", { code: "BFCM20", percentOff: 20, endsAt }),
    ).toEqual({
      perMonth: "6.40",
      compareAt: "8",
      note: "20% off with BFCM20 until 25 Nov 2027, then $8/mo",
    });
  });

  test("an annual discount shows the first year's charge", () => {
    expect(
      subscribedPriceDisplay("ultra", "annual", { code: "BFCM20", percentOff: 20, endsAt }),
    ).toEqual({
      perMonth: "10",
      compareAt: "12.50",
      note: "billed $120 the first year (20% off with BFCM20), then $150/yr",
    });
  });

  test("a discount of unknown size shows the list price with discount applied", () => {
    expect(
      subscribedPriceDisplay("pro", "annual", { code: "PARTNER10", percentOff: null, endsAt }),
    ).toEqual({
      ...planPriceDisplay("pro", "annual"),
      note: "billed $80 yearly, discount applied",
    });
  });
});

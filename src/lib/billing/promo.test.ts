import { describe, expect, test } from "bun:test";

import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import {
  ACTIVE_PROMO,
  checkoutDiscountCode,
  formatPromoEnd,
  formatPromoEndShort,
  getActivePromo,
  promoBannerText,
  promoOfferLine,
  promoPrice,
} from "./promo";

describe("getActivePromo", () => {
  test("is null before the window", () => {
    expect(getActivePromo(new Date("2026-11-21T12:00:00Z"))).toBeNull();
    expect(getActivePromo(new Date("2026-11-24T23:59:59.999Z"))).toBeNull();
  });

  test("returns the promo inside the window, including both boundaries", () => {
    expect(getActivePromo(new Date("2026-11-25T00:00:00Z"))).toBe(ACTIVE_PROMO);
    expect(getActivePromo(new Date("2026-11-28T15:30:00Z"))).toBe(ACTIVE_PROMO);
    expect(getActivePromo(new Date("2026-12-01T23:59:59Z"))).toBe(ACTIVE_PROMO);
  });

  test("is null after the window", () => {
    expect(getActivePromo(new Date("2026-12-01T23:59:59.001Z"))).toBeNull();
    expect(getActivePromo(new Date("2026-12-02T00:00:00Z"))).toBeNull();
    expect(getActivePromo(new Date("2027-01-15T00:00:00Z"))).toBeNull();
  });
});

describe("checkoutDiscountCode", () => {
  test("applies the code only inside the window", () => {
    expect(checkoutDiscountCode(new Date("2026-11-26T09:00:00Z"))).toBe("BFCM20");
    expect(checkoutDiscountCode(new Date("2026-11-24T09:00:00Z"))).toBeUndefined();
    expect(checkoutDiscountCode(new Date("2026-12-02T09:00:00Z"))).toBeUndefined();
  });
});

describe("promoPrice", () => {
  test("takes 20% off the list prices, rounded to cents", () => {
    expect(promoPrice(PLAN_PRICES_USD.pro, ACTIVE_PROMO)).toBe(6.4);
    expect(promoPrice(PLAN_PRICES_USD.ultra, ACTIVE_PROMO)).toBe(12);
    expect(promoPrice(PLAN_PRICES_ANNUAL_USD.pro, ACTIVE_PROMO)).toBe(64);
    expect(promoPrice(PLAN_PRICES_ANNUAL_USD.ultra, ACTIVE_PROMO)).toBe(120);
  });

  test("rounds fractional cents", () => {
    expect(promoPrice(9.99, ACTIVE_PROMO)).toBe(7.99);
    expect(promoPrice(80 / 12, ACTIVE_PROMO)).toBe(5.33);
  });
});

describe("promoBannerText", () => {
  test("names the end as a UTC date", () => {
    expect(promoBannerText(ACTIVE_PROMO)).toBe(
      "Black Friday: 20% off your first year of Pro or Ultra. Applied at checkout, until Tuesday 1 December.",
    );
  });
});

describe("promoOfferLine", () => {
  test("names the plan, the discount and the last day", () => {
    expect(promoOfferLine(ACTIVE_PROMO, "Pro")).toBe(
      "Black Friday: Pro is 20% off your first year until Tuesday 1 December.",
    );
  });
});

describe("formatPromoEnd", () => {
  test("long and short forms of the last day, in UTC", () => {
    expect(formatPromoEnd(ACTIVE_PROMO.endsAt)).toBe("Tuesday 1 December");
    expect(formatPromoEndShort(ACTIVE_PROMO.endsAt)).toBe("Tue 1 Dec");
  });
});

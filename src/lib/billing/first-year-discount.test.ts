import { describe, expect, test } from "bun:test";

import {
  checkoutDiscountTerms,
  paddleDiscountCode,
  planChangeDiscount,
  promoDiscountActive,
  promoFirstPaymentAt,
} from "./first-year-discount";

const firstPaymentAt = new Date("2026-11-27T10:00:00Z");
// Inside billing month `n` (0 is the first payment's month).
const inMonth = (n: number) => new Date(Date.UTC(2026, 10 + n, 27, 10) + 5 * 24 * 60 * 60 * 1000);

describe("checkout discounts", () => {
  test("monthly checkout recurs for 12 payments", () => {
    expect(checkoutDiscountTerms("monthly")).toEqual({
      recur: true,
      maximumRecurringIntervals: 12,
    });
    expect(paddleDiscountCode("BFCM20", "monthly")).toBe("BFCM20");
  });

  test("annual checkout is a one-off discount with its own code", () => {
    expect(checkoutDiscountTerms("annual")).toEqual({
      recur: false,
      maximumRecurringIntervals: null,
    });
    expect(paddleDiscountCode("BFCM20", "annual")).toBe("BFCM20ANNUAL");
  });
});

describe("planChangeDiscount", () => {
  test("monthly to annual in the first year discounts that annual payment once", () => {
    for (const month of [0, 5, 11]) {
      expect(
        planChangeDiscount({
          firstPaymentAt,
          from: "monthly",
          to: "annual",
          billsNow: true,
          now: inMonth(month),
        }),
      ).toEqual({
        action: "apply",
        terms: { recur: true, maximumRecurringIntervals: 1 },
        effectiveFrom: "immediately",
      });
    }
  });

  test("a Pro/Ultra switch on monthly carries over the rest of the first year", () => {
    // Upgrade billed now: the current month (with its prorated charge) through month 12.
    expect(
      planChangeDiscount({
        firstPaymentAt,
        from: "monthly",
        to: "monthly",
        billsNow: true,
        now: inMonth(3),
      }),
    ).toEqual({
      action: "apply",
      terms: { recur: true, maximumRecurringIntervals: 9 },
      effectiveFrom: "immediately",
    });
    // A change billed at renewal: the 8 monthly payments still to come.
    expect(
      planChangeDiscount({
        firstPaymentAt,
        from: "monthly",
        to: "monthly",
        billsNow: false,
        now: inMonth(3),
      }),
    ).toEqual({
      action: "apply",
      terms: { recur: true, maximumRecurringIntervals: 8 },
      effectiveFrom: "next_billing_period",
    });
  });

  test("a downgrade in the twelfth month has no discounted payment left", () => {
    expect(
      planChangeDiscount({
        firstPaymentAt,
        from: "monthly",
        to: "monthly",
        billsNow: false,
        now: inMonth(11),
      }),
    ).toEqual({ action: "remove" });
    expect(
      planChangeDiscount({
        firstPaymentAt,
        from: "monthly",
        to: "monthly",
        billsNow: true,
        now: inMonth(11),
      }),
    ).toMatchObject({ terms: { maximumRecurringIntervals: 1 } });
  });

  test("an annual Pro/Ultra upgrade in the first year discounts its prorated charge once", () => {
    expect(
      planChangeDiscount({
        firstPaymentAt,
        from: "annual",
        to: "annual",
        billsNow: true,
        now: inMonth(4),
      }),
    ).toEqual({
      action: "apply",
      terms: { recur: true, maximumRecurringIntervals: 1 },
      effectiveFrom: "immediately",
    });
    expect(
      planChangeDiscount({
        firstPaymentAt,
        from: "annual",
        to: "annual",
        billsNow: false,
        now: inMonth(4),
      }),
    ).toEqual({ action: "remove" });
  });

  test("annual to monthly gets nothing more: the annual payment was the discounted one", () => {
    expect(
      planChangeDiscount({
        firstPaymentAt,
        from: "annual",
        to: "monthly",
        billsNow: true,
        now: inMonth(2),
      }),
    ).toEqual({ action: "remove" });
  });

  test("any change after month 12 removes the discount", () => {
    for (const [from, to] of [
      ["monthly", "monthly"],
      ["monthly", "annual"],
      ["annual", "annual"],
      ["annual", "monthly"],
    ] as const) {
      for (const now of [new Date("2027-11-27T10:00:00Z"), inMonth(13), inMonth(30)]) {
        expect(planChangeDiscount({ firstPaymentAt, from, to, billsNow: true, now })).toEqual({
          action: "remove",
        });
      }
    }
  });
});

describe("promoDiscountActive", () => {
  const firstYearEnd = new Date("2027-11-27T10:00:00Z");

  test("monthly runs to the end of the first year, whatever the plan", () => {
    expect(
      promoDiscountActive({
        checkoutInterval: "monthly",
        interval: "monthly",
        firstPaymentAt,
        periodEndsAt: inMonth(4),
        now: inMonth(3),
      }),
    ).toEqual({ endsAt: firstYearEnd });
    expect(
      promoDiscountActive({
        checkoutInterval: "monthly",
        interval: "monthly",
        firstPaymentAt,
        periodEndsAt: inMonth(13),
        now: inMonth(12),
      }),
    ).toBeNull();
  });

  test("monthly after an annual checkout has no discount", () => {
    expect(
      promoDiscountActive({
        checkoutInterval: "annual",
        interval: "monthly",
        firstPaymentAt,
        periodEndsAt: inMonth(4),
        now: inMonth(3),
      }),
    ).toBeNull();
  });

  test("annual covers the annual period that started in the first year", () => {
    const switchedAt = new Date("2027-05-27T10:00:00Z");
    const periodEndsAt = new Date("2028-05-27T10:00:00Z");
    expect(
      promoDiscountActive({
        checkoutInterval: "monthly",
        interval: "annual",
        firstPaymentAt,
        periodEndsAt,
        now: switchedAt,
      }),
    ).toEqual({ endsAt: periodEndsAt });
    expect(
      promoDiscountActive({
        checkoutInterval: "annual",
        interval: "annual",
        firstPaymentAt,
        periodEndsAt: firstYearEnd,
        now: inMonth(6),
      }),
    ).toEqual({ endsAt: firstYearEnd });
  });

  test("an annual period that started after the first year has no discount", () => {
    expect(
      promoDiscountActive({
        checkoutInterval: "annual",
        interval: "annual",
        firstPaymentAt,
        periodEndsAt: new Date("2028-11-27T10:00:00Z"),
        now: inMonth(13),
      }),
    ).toBeNull();
    expect(
      promoDiscountActive({
        checkoutInterval: "monthly",
        interval: "annual",
        firstPaymentAt,
        periodEndsAt: new Date("2029-01-27T10:00:00Z"),
        now: inMonth(15),
      }),
    ).toBeNull();
  });
});

describe("promoDiscountActive after a plan change removed the discount", () => {
  test("monthly after an annual period (monthly → annual → monthly) has no discount", () => {
    expect(
      promoDiscountActive({
        checkoutInterval: "monthly",
        interval: "monthly",
        firstPaymentAt,
        periodEndsAt: inMonth(9),
        endedAt: inMonth(8),
        now: inMonth(8),
      }),
    ).toBeNull();
  });

  test("a removal from an earlier subscription on the same row is ignored", () => {
    expect(
      promoDiscountActive({
        checkoutInterval: "monthly",
        interval: "monthly",
        firstPaymentAt,
        periodEndsAt: inMonth(4),
        endedAt: new Date("2025-06-01T00:00:00Z"),
        now: inMonth(3),
      }),
    ).toEqual({ endsAt: new Date("2027-11-27T10:00:00Z") });
  });
});

describe("promoDiscountActive with Paddle's period anchored before created_at", () => {
  test("the second annual period, starting seconds before the first year ends, is not discounted", () => {
    expect(
      promoDiscountActive({
        checkoutInterval: "annual",
        interval: "annual",
        firstPaymentAt: new Date("2026-11-27T10:00:05Z"),
        periodEndsAt: new Date("2028-11-27T10:00:04Z"),
        now: new Date("2028-01-15T00:00:00Z"),
      }),
    ).toBeNull();
  });
});

describe("promoFirstPaymentAt", () => {
  const checkoutAt = new Date("2026-11-27T09:59:00Z");

  test("is the subscription's createdAt when it follows the checkout", () => {
    expect(promoFirstPaymentAt(firstPaymentAt, checkoutAt)).toEqual(firstPaymentAt);
  });

  test("ignores a reused row's createdAt from an earlier subscription", () => {
    expect(promoFirstPaymentAt(new Date("2024-03-01T00:00:00Z"), checkoutAt)).toEqual(checkoutAt);
  });

  test("falls back to the checkout when the row has no createdAt", () => {
    expect(promoFirstPaymentAt(null, checkoutAt)).toEqual(checkoutAt);
  });
});

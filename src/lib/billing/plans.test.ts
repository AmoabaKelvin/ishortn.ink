import { describe, expect, test } from "bun:test";

import {
  canOfferPause,
  getSubscriptionMode,
  isSubscriptionEntitled,
  pauseResumesAt,
  resolvePlan,
} from "./plans";

import type { Subscription } from "@/server/db/schema";

const DAY = 24 * 60 * 60 * 1000;
const PRO_MONTHLY_VARIANT_ID = 1811616;
const ULTRA_MONTHLY_VARIANT_ID = 1108002;

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 1,
    userId: "user_1",
    orderId: 10,
    subscriptionId: 100,
    customerId: 1000,
    renewsAt: new Date(Date.now() + 20 * DAY),
    createdAt: new Date(Date.now() - 10 * DAY),
    endsAt: null,
    status: "active",
    plan: "pro",
    billingInterval: "monthly",
    variantId: PRO_MONTHLY_VARIANT_ID,
    productId: 0,
    providerUpdatedAt: null,
    pausedUntil: null,
    cardBrand: "visa",
    cardLastFour: "4242",
    ...overrides,
  };
}

const inPeriod = new Date(Date.now() + 5 * DAY);
const pastPeriod = new Date(Date.now() - 5 * DAY);

describe("resolvePlan", () => {
  test("no subscription is free", () => {
    expect(resolvePlan(null)).toBe("free");
    expect(resolvePlan(undefined)).toBe("free");
  });

  test.each(["active", "on_trial", "past_due"])("%s keeps the paid plan", (status) => {
    expect(resolvePlan(sub({ status }))).toBe("pro");
    expect(resolvePlan(sub({ status, variantId: ULTRA_MONTHLY_VARIANT_ID }))).toBe("ultra");
  });

  test("cancelled keeps the plan until endsAt", () => {
    expect(resolvePlan(sub({ status: "cancelled", endsAt: inPeriod }))).toBe("pro");
    expect(resolvePlan(sub({ status: "cancelled", endsAt: pastPeriod }))).toBe("free");
    expect(resolvePlan(sub({ status: "cancelled", endsAt: null }))).toBe("free");
  });

  test("expired is free", () => {
    expect(resolvePlan(sub({ status: "expired", plan: "free", variantId: 0 }))).toBe("free");
    expect(resolvePlan(sub({ status: "expired" }))).toBe("free");
  });

  test("unrecognised variant with a free plan resolves to free, not pro", () => {
    expect(
      resolvePlan(
        sub({ status: "active", plan: "free", variantId: 0, productId: 0, renewsAt: pastPeriod }),
      ),
    ).toBe("free");
    expect(resolvePlan(sub({ plan: null, variantId: 0, productId: 0 }))).toBe("free");
  });

  test("unrecognised variant falls back to the stored paid plan", () => {
    expect(resolvePlan(sub({ plan: "ultra", variantId: 999 }))).toBe("ultra");
    expect(resolvePlan(sub({ plan: "pro", variantId: 999 }))).toBe("pro");
  });
});

describe("isSubscriptionEntitled", () => {
  test.each([
    ["active", null, true],
    ["on_trial", null, true],
    ["past_due", null, true],
    ["cancelled", inPeriod, true],
    ["cancelled", pastPeriod, false],
    ["expired", null, false],
    ["unpaid", null, false],
  ] as const)("%s (endsAt %p) => %p", (status, endsAt, expected) => {
    expect(isSubscriptionEntitled(sub({ status, endsAt }))).toBe(expected);
  });
});

describe("getSubscriptionMode", () => {
  test("no subscription starts a checkout", () => {
    expect(getSubscriptionMode(null)).toBe("checkout");
  });

  test.each(["active", "on_trial", "past_due"])("%s is changed in place", (status) => {
    expect(getSubscriptionMode(sub({ status }))).toBe("update");
  });

  test("cancelled within the paid period must be resumed", () => {
    expect(getSubscriptionMode(sub({ status: "cancelled", endsAt: inPeriod }))).toBe("resume");
  });

  test("cancelled after the paid period starts a checkout", () => {
    expect(getSubscriptionMode(sub({ status: "cancelled", endsAt: pastPeriod }))).toBe("checkout");
  });

  test("expired starts a checkout", () => {
    expect(
      getSubscriptionMode(sub({ status: "expired", plan: "free", variantId: 0, productId: 0 })),
    ).toBe("checkout");
  });

  test("unrecognised free-plan row starts a checkout instead of updating", () => {
    expect(
      getSubscriptionMode(sub({ status: "active", plan: "free", variantId: 0, productId: 0 })),
    ).toBe("checkout");
  });

  test("a row without a provider subscription id cannot be updated", () => {
    expect(getSubscriptionMode(sub({ subscriptionId: 0 }))).toBe("checkout");
    expect(getSubscriptionMode(sub({ subscriptionId: null }))).toBe("checkout");
  });

  test("paused must be resumed, never checked out again", () => {
    expect(resolvePlan(sub({ status: "paused" }))).toBe("free");
    expect(getSubscriptionMode(sub({ status: "paused" }))).toBe("resume");
  });
});

describe("canOfferPause", () => {
  test("an active monthly subscription is offered a pause", () => {
    expect(canOfferPause(sub({}))).toBe(true);
    expect(canOfferPause(sub({ variantId: 441105 }))).toBe(true);
  });

  test.each(["on_trial", "past_due", "cancelled", "paused"])("%s is not", (status) => {
    expect(canOfferPause(sub({ status }))).toBe(false);
  });

  test("annual subscriptions and rows without a provider id are not", () => {
    expect(canOfferPause(sub({ variantId: 1809620 }))).toBe(false);
    expect(canOfferPause(sub({ subscriptionId: 0 }))).toBe(false);
    expect(canOfferPause(null)).toBe(false);
  });
});

describe("pauseResumesAt", () => {
  test.each([
    [1, "2026-12-23T10:00:00.000Z"],
    [2, "2027-01-23T10:00:00.000Z"],
    [3, "2027-02-23T10:00:00.000Z"],
  ])("%p months", (months, expected) => {
    expect(pauseResumesAt(months, new Date("2026-11-23T10:00:00Z")).toISOString()).toBe(expected);
  });
});

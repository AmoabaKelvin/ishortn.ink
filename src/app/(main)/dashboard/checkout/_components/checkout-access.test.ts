import { describe, expect, test } from "bun:test";

import { checkoutAccess } from "./checkout-access";

import type { Subscription } from "@/server/db/schema";

// SAFETY: getSubscriptionMode reads only these fields of the row.
const paddleRow = (fields: Partial<Subscription>) =>
  ({
    billingProvider: "paddle",
    subscriptionId: null,
    providerSubscriptionId: "sub_live",
    providerCustomerId: "ctm_row",
    variantId: null,
    productId: null,
    plan: "pro",
    status: "active",
    endsAt: null,
    pausedUntil: null,
    ...fields,
  }) as Subscription;

const newSubscriptionTransaction = async () => ({ status: "ready", subscription_id: null });
const paymentMethodUpdate = async () => ({ status: "ready", subscription_id: "sub_live" });
const replacedTransaction = async () => ({ status: "canceled", subscription_id: null });

describe("checkoutAccess", () => {
  test.each([
    ["active", paddleRow({ status: "active" })],
    ["trialing", paddleRow({ status: "on_trial" })],
    ["past due", paddleRow({ status: "past_due" })],
    ["paused", paddleRow({ status: "paused" })],
  ])("refuses a new-subscription checkout for an %s subscriber", async (_, row) => {
    expect(await checkoutAccess(row, newSubscriptionTransaction)).toBe("subscribed");
  });

  test.each([
    ["active", paddleRow({ status: "active" })],
    ["past due", paddleRow({ status: "past_due" })],
  ])("opens a payment-method update for an %s subscriber", async (_, row) => {
    expect(await checkoutAccess(row, paymentMethodUpdate)).toBe("open");
  });

  test("opens a checkout for a user without a subscription", async () => {
    expect(await checkoutAccess(null, newSubscriptionTransaction)).toBe("open");
    expect(await checkoutAccess(paddleRow({ status: "expired" }), newSubscriptionTransaction)).toBe(
      "open",
    );
  });

  test("a canceled checkout, replaced by a newer one, is not opened", async () => {
    expect(await checkoutAccess(null, replacedTransaction)).toBe("replaced");
    expect(await checkoutAccess(paddleRow({ status: "expired" }), replacedTransaction)).toBe(
      "replaced",
    );
  });

  test("a subscriber's stale new-subscription checkout still reads as subscribed", async () => {
    expect(await checkoutAccess(paddleRow({ status: "active" }), replacedTransaction)).toBe(
      "subscribed",
    );
  });

  test("without a subscription a failed lookup still opens the checkout", async () => {
    const failing = async () => {
      throw new Error("paddle down");
    };
    expect(await checkoutAccess(null, failing)).toBe("open");
  });

  test("a subscriber's failed transaction lookup propagates instead of opening the checkout", async () => {
    const failing = async () => {
      throw new Error("paddle down");
    };

    await expect(checkoutAccess(paddleRow({ status: "active" }), failing)).rejects.toThrow(
      "paddle down",
    );
  });
});

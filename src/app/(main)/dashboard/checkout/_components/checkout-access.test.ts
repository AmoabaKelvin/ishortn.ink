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

const newSubscriptionTransaction = async () => ({ subscription_id: null });
const paymentMethodUpdate = async () => ({ subscription_id: "sub_live" });

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

  test("opens a checkout for a user without a subscription and skips the Paddle lookup", async () => {
    let lookups = 0;
    const lookup = async () => {
      lookups += 1;
      return { subscription_id: null };
    };

    expect(await checkoutAccess(null, lookup)).toBe("open");
    expect(await checkoutAccess(paddleRow({ status: "expired" }), lookup)).toBe("open");
    expect(lookups).toBe(0);
  });

  test("a failed transaction lookup propagates instead of opening the checkout", async () => {
    const failing = async () => {
      throw new Error("paddle down");
    };

    await expect(checkoutAccess(paddleRow({ status: "active" }), failing)).rejects.toThrow(
      "paddle down",
    );
  });
});

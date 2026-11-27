import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { buildPaddleConfig } from "@/lib/paddle/config";

import {
  orderCompletedEvent,
  paddleTransactionSchema,
  paidSubscriptionId,
  transactionCard,
} from "./transaction";

import type { PaddleConfig } from "@/lib/paddle/config";

const PRO_ANNUAL = "pri_01pro_annual";

function testConfig(environment: "sandbox" | "production" = "sandbox") {
  const config = buildPaddleConfig({
    BILLING_PROVIDER: undefined,
    PADDLE_ENVIRONMENT: environment,
    PADDLE_API_KEY: environment === "sandbox" ? "pdl_sdbx_tx_test" : "pdl_live_tx_test",
    PADDLE_WEBHOOK_SECRET: "pdl_ntfset_tx_test",
    PADDLE_CLIENT_TOKEN: environment === "sandbox" ? "test_tx_test" : "live_tx_test",
    PADDLE_PRICE_PRO_MONTHLY: "pri_01pro_monthly",
    PADDLE_PRICE_PRO_ANNUAL: PRO_ANNUAL,
    PADDLE_PRICE_ULTRA_MONTHLY: "pri_01ultra_monthly",
    PADDLE_PRICE_ULTRA_ANNUAL: "pri_01ultra_annual",
    PADDLE_PRICE_PRO_LEGACY_MONTHLY: undefined,
    PADDLE_CHECKOUT_USER_IDS: undefined,
  });
  if (!config) throw new Error("test config did not build");
  return config;
}

const config: PaddleConfig = testConfig();

function transaction(overrides: Partial<z.input<typeof paddleTransactionSchema>> = {}) {
  return paddleTransactionSchema.parse({
    id: "txn_01test",
    status: "completed",
    origin: "web",
    subscription_id: "sub_01test",
    items: [{ price_id: PRO_ANNUAL, price: { id: PRO_ANNUAL }, quantity: 1 }],
    details: { totals: { total: "5990", currency_code: "USD" } },
    payments: [
      { method_details: { type: "card", card: { type: "american_express", last4: "0005" } } },
    ],
    custom_data: {
      user_id: "user_1",
      discount_code: "BFCM20",
      source: "pricing",
      utm_campaign: "bfcm",
    },
    ...overrides,
  });
}

describe("paidSubscriptionId", () => {
  test("is the subscription for a completed first payment or renewal", () => {
    expect(paidSubscriptionId(transaction())).toBe("sub_01test");
    expect(paidSubscriptionId(transaction({ origin: "subscription_recurring" }))).toBe(
      "sub_01test",
    );
  });

  test("is null for other statuses, origins and one-off transactions", () => {
    expect(paidSubscriptionId(transaction({ status: "paid" }))).toBeNull();
    expect(paidSubscriptionId(transaction({ origin: "api" }))).toBeNull();
    expect(paidSubscriptionId(transaction({ origin: "subscription_charge" }))).toBeNull();
    expect(paidSubscriptionId(transaction({ subscription_id: null }))).toBeNull();
  });
});

describe("transactionCard", () => {
  test("reads the brand and last four of the first payment", () => {
    expect(transactionCard(transaction())).toEqual({
      cardBrand: "american express",
      cardLastFour: "0005",
    });
  });

  test("labels an unknown brand as a card", () => {
    const payments = [{ method_details: { card: { type: "unknown", last4: "4242" } } }];
    expect(transactionCard(transaction({ payments }))?.cardBrand).toBe("card");
  });

  test("is null for a payment without a card", () => {
    const payments = [{ method_details: { type: "paypal", card: null } }];
    expect(transactionCard(transaction({ payments }))).toBeNull();
    expect(transactionCard(transaction({ payments: [] }))).toBeNull();
  });
});

describe("orderCompletedEvent", () => {
  test("carries the checkout funnel's properties", () => {
    expect(orderCompletedEvent(transaction(), config)).toEqual({
      userId: "user_1",
      properties: {
        plan: "pro",
        interval: "annual",
        discount_code: "BFCM20",
        source: "pricing",
        utm_campaign: "bfcm",
        order_id: "txn_01test",
        amount: 59.9,
        currency: "USD",
        test_mode: true,
        provider: "paddle",
      },
    });
  });

  test("is not test mode in production", () => {
    const event = orderCompletedEvent(transaction(), testConfig("production"));
    expect(event?.properties.test_mode).toBe(false);
  });

  test("reads zero-decimal amounts as whole units", () => {
    const details = { totals: { total: "1200", currency_code: "JPY" } };
    expect(orderCompletedEvent(transaction({ details }), config)?.properties.amount).toBe(1200);
  });

  test("is null for a renewal", () => {
    expect(
      orderCompletedEvent(transaction({ origin: "subscription_recurring" }), config),
    ).toBeNull();
  });

  test("is null without a user_id", () => {
    expect(orderCompletedEvent(transaction({ custom_data: null }), config)).toBeNull();
    expect(orderCompletedEvent(transaction({ custom_data: { user_id: 42 } }), config)).toBeNull();
  });

  test("is null for an unknown price", () => {
    const items = [{ price: { id: "pri_01other" } }];
    expect(orderCompletedEvent(transaction({ items }), config)).toBeNull();
  });
});

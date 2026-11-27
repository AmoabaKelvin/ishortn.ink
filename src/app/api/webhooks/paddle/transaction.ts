import { z } from "zod";

import { checkoutEventProperties, readAttribution } from "@/lib/billing/attribution";
import { planFromPaddlePrice } from "@/lib/paddle/config";

import type { PaddleConfig } from "@/lib/paddle/config";

// Paddle allows any JSON in custom_data; a value of another type reads as unset rather than
// failing the delivery.
const customValue = z.string().optional().catch(undefined);

// The checkout's custom data: the user, its attribution and discount code (checkoutCustomData).
const customDataSchema = z
  .object({
    user_id: customValue,
    discount_code: customValue,
    source: customValue,
    utm_source: customValue,
    utm_medium: customValue,
    utm_campaign: customValue,
    utm_term: customValue,
    utm_content: customValue,
  })
  .nullish()
  .catch(null);

// The fields of Paddle's transaction entity that the app reads.
export const paddleTransactionSchema = z.object({
  id: z.string(),
  status: z.string(),
  origin: z.string().nullish(),
  subscription_id: z.string().nullish(),
  items: z
    .array(
      z.object({
        price_id: z.string().nullish(),
        price: z.object({ id: z.string() }).nullish(),
      }),
    )
    .nullish(),
  details: z
    .object({
      totals: z.object({ total: z.string(), currency_code: z.string() }).nullish(),
    })
    .nullish(),
  payments: z
    .array(
      z.object({
        method_details: z
          .object({
            card: z.object({ type: z.string().nullish(), last4: z.string().nullish() }).nullish(),
          })
          .nullish(),
      }),
    )
    .nullish(),
  custom_data: customDataSchema,
});

export type PaddleTransaction = z.infer<typeof paddleTransactionSchema>;

// The first payment from our checkout, and each renewal. Other origins (manual invoices, API
// one-offs, proration charges) aren't subscription payments the funnel or the card reads.
const SUBSCRIPTION_PAYMENT_ORIGINS = new Set(["web", "subscription_recurring"]);

/** The subscription a completed subscription payment belongs to, or null for any other transaction. */
export function paidSubscriptionId(transaction: PaddleTransaction): string | null {
  if (transaction.status !== "completed") return null;
  if (!transaction.origin || !SUBSCRIPTION_PAYMENT_ORIGINS.has(transaction.origin)) return null;
  return transaction.subscription_id || null;
}

/** The card the transaction was paid with, or null when it wasn't a card (e.g. PayPal). */
export function transactionCard(
  transaction: PaddleTransaction,
): { cardBrand: string; cardLastFour: string } | null {
  const card = transaction.payments?.[0]?.method_details?.card;
  const last4 = card?.last4;
  if (!last4) return null;
  // Paddle's types are snake_case (`american_express`); the billing page capitalises the brand.
  const brand = card.type && card.type !== "unknown" ? card.type.replaceAll("_", " ") : "card";
  return { cardBrand: brand, cardLastFour: last4.slice(-4) };
}

// Paddle amounts are strings in the currency's lowest denomination; these have no minor unit.
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW"]);

/**
 * The `order_completed` PostHog properties for the first payment of a checkout, matching the
 * Lemon Squeezy event (see lemonsqueezy/order-event.ts). Null when the transaction isn't a
 * completed first payment from the in-app checkout (no user_id) or is for an unknown price.
 */
export function orderCompletedEvent(transaction: PaddleTransaction, config: PaddleConfig) {
  if (transaction.origin !== "web" || !paidSubscriptionId(transaction)) return null;
  const customData = transaction.custom_data;
  const userId = customData?.user_id;
  const item = transaction.items?.[0];
  const priceId = item?.price?.id ?? item?.price_id;
  const price = priceId ? planFromPaddlePrice(priceId, config) : null;
  if (!userId || !price) return null;

  const totals = transaction.details?.totals;
  const minorUnits = Number(totals?.total);
  const currency = totals?.currency_code;
  const amount =
    totals && Number.isFinite(minorUnits)
      ? minorUnits / (currency && ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100)
      : undefined;

  return {
    userId,
    properties: checkoutEventProperties({
      plan: price.plan,
      interval: price.interval,
      discount_code: customData?.discount_code,
      ...readAttribution({ get: (key) => customData?.[key] }),
      order_id: transaction.id,
      amount,
      currency,
      test_mode: config.environment === "sandbox",
      provider: "paddle",
    }),
  };
}

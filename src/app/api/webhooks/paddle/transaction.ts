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
  // The discount applied at checkout, whether the in-app checkout set it or the customer typed a
  // code into Paddle's checkout.
  discount_id: z.string().nullish(),
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
        status: z.string().nullish(),
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

// Checkouts started server-side create the transaction through the API (`api`); the overlay
// checkout creates it in the browser (`web`). Other origins (manual invoices, adjustments,
// proration charges) aren't first payments.
const FIRST_PAYMENT_ORIGINS = new Set(["web", "api"]);

function capturedPayment(transaction: PaddleTransaction) {
  return transaction.payments?.find((payment) => payment.status === "captured") ?? null;
}

/** Whether the transaction is the completed, captured first payment of a subscription. */
export function isFirstPayment(transaction: PaddleTransaction): boolean {
  return (
    transaction.status === "completed" &&
    FIRST_PAYMENT_ORIGINS.has(transaction.origin ?? "") &&
    Boolean(transaction.subscription_id) &&
    capturedPayment(transaction) !== null
  );
}

/** The subscription a first payment or renewal belongs to, or null for any other transaction. */
export function paidSubscriptionId(transaction: PaddleTransaction): string | null {
  if (transaction.status !== "completed") return null;
  if (!isFirstPayment(transaction) && transaction.origin !== "subscription_recurring") return null;
  return transaction.subscription_id || null;
}

/** The card the transaction was paid with, or null when it wasn't a card (e.g. PayPal). */
export function transactionCard(
  transaction: PaddleTransaction,
): { cardBrand: string; cardLastFour: string } | null {
  // A transaction can carry failed attempts before the one that succeeded.
  const payment = capturedPayment(transaction) ?? transaction.payments?.[0];
  const card = payment?.method_details?.card;
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
export function orderCompletedEvent(
  transaction: PaddleTransaction,
  config: PaddleConfig,
  discountCode = transaction.custom_data?.discount_code,
) {
  if (!isFirstPayment(transaction)) return null;
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
      discount_code: discountCode,
      ...readAttribution({ get: (key) => customData?.[key] }),
      order_id: transaction.id,
      amount,
      currency,
      test_mode: config.environment === "sandbox",
      provider: "paddle",
      billing_env: config.environment,
    }),
  };
}

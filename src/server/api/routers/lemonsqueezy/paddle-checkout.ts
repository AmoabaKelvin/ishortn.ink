import { TRPCError } from "@trpc/server";

import { checkoutCustomData } from "@/lib/billing/attribution";
import { logger } from "@/lib/logger";
import { PaddleApiError } from "@/lib/paddle/client";

import {
  createCheckoutWithPromoFallback,
  paddlePromoRejected,
  providerErrorToClient,
} from "./utils";

import type { Attribution } from "@/lib/billing/attribution";
import type { BillingInterval } from "@/lib/billing/plans";
import type { PaddleClient, PaddleTransaction } from "@/lib/paddle/client";
import type { PaidPlan } from "@/lib/paddle/config";
import type { Subscription } from "@/server/db/schema";

const log = logger.child({ component: "billing.paddle" });

export type PaddleCheckoutInput = {
  userId: string;
  email: string | null | undefined;
  subscription: Subscription | null | undefined;
  plan: PaidPlan;
  interval: BillingInterval;
  priceId: string;
  attribution: Attribution;
  promoCode: string | undefined;
};

/** The Paddle calls a new checkout makes. */
export type PaddleCheckoutClient = Pick<
  PaddleClient,
  "findCustomerByEmail" | "createCustomer" | "findActiveDiscountIdByCode" | "createTransaction"
>;

type TransactionResult =
  | { transaction: PaddleTransaction; error: null }
  | { transaction: null; error: Error };

function providerError(action: string, error: Error, userId: string): TRPCError {
  log.error({ err: error, userId }, `paddle ${action} failed`);
  return new TRPCError(
    providerErrorToClient(error instanceof PaddleApiError ? error.status : null),
  );
}

async function resolveCustomerId(client: PaddleCheckoutClient, input: PaddleCheckoutInput) {
  const { subscription, email } = input;
  if (subscription?.billingProvider === "paddle" && subscription.providerCustomerId) {
    return subscription.providerCustomerId;
  }
  // Without an email Paddle's checkout collects one and creates the customer itself.
  if (!email) return undefined;
  const existing = await client.findCustomerByEmail(email);
  return (existing ?? (await client.createCustomer({ email }))).id;
}

/** Paddle transactions take a discount id; a code with no active discount is dropped. */
async function resolveDiscountId(
  client: PaddleCheckoutClient,
  code: string | undefined,
  userId: string,
) {
  if (!code) return undefined;
  const id = await client.findActiveDiscountIdByCode(code).catch((err: Error) => {
    log.warn({ err, userId, discountCode: code }, "paddle discount lookup failed");
    return undefined;
  });
  if (!id) log.warn({ userId, discountCode: code }, "no active paddle discount for promo code");
  return id;
}

/**
 * Creates a Paddle transaction for a new subscription. Its checkout URL is the account's default
 * payment link (`/dashboard/checkout?_ptxn=…`), so callers redirect to it like a Lemon Squeezy
 * checkout. `discountCode` is the code the transaction was created with.
 */
export async function createPaddleCheckout(
  client: PaddleCheckoutClient,
  input: PaddleCheckoutInput,
) {
  const { userId, plan, interval } = input;

  const [customerId, discountId] = await Promise.all([
    resolveCustomerId(client, input),
    resolveDiscountId(client, input.promoCode, userId),
  ]).catch((error: Error) => {
    throw providerError("customer lookup", error, userId);
  });

  const { result, discountCode } = await createCheckoutWithPromoFallback(
    (code?: string): Promise<TransactionResult> =>
      client
        .createTransaction({
          items: [{ priceId: input.priceId, quantity: 1 }],
          customerId,
          collectionMode: "automatic",
          // Read back by the webhooks to link the subscription to the user and attribute it.
          customData: { ...checkoutCustomData(userId, input.attribution, code), plan, interval },
          discountId: code ? discountId : undefined,
        })
        .then(
          (transaction) => ({ transaction, error: null }),
          (error: Error) => ({ transaction: null, error }),
        ),
    paddlePromoRejected,
    discountId ? input.promoCode : undefined,
    (rejected) =>
      log.warn(
        { userId, discountCode: input.promoCode, err: rejected.error },
        "promo code rejected, retrying checkout without it",
      ),
  );

  if (!result.transaction) throw providerError("checkout", result.error, userId);

  const url = result.transaction.checkout?.url;
  if (!url) {
    // Paddle only returns a URL once a default payment link is set on the account.
    log.error({ userId, transactionId: result.transaction.id }, "paddle checkout returned no url");
    throw new TRPCError(providerErrorToClient(null));
  }

  return { url, discountCode };
}

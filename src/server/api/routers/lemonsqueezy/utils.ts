import { PaddleApiError } from "@/lib/paddle/client";

import type { PlanChangeCharge } from "@/lib/billing/plan-change-copy";
import type { PaddleSubscriptionPreview } from "@/lib/paddle/client";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

export type ClientBillingError = {
  code: TRPC_ERROR_CODE_KEY;
  message: string;
};

/**
 * User-facing message for a failed payment provider call. Provider messages are
 * technical (JSON:API validation details, ids) and are logged, never shown.
 */
export function providerErrorToClient(statusCode: number | null): ClientBillingError {
  if (statusCode === 404) {
    return {
      code: "NOT_FOUND",
      message:
        "We couldn't find your subscription with our payment provider. Please contact support.",
    };
  }
  if (statusCode === 402 || statusCode === 422) {
    return {
      code: "BAD_REQUEST",
      message:
        "Our payment provider couldn't apply this change. Check your payment method under Invoices & payment method in Settings → Billing and try again.",
    };
  }
  if (statusCode === 429) {
    return {
      code: "TOO_MANY_REQUESTS",
      message: "Too many billing requests. Please wait a minute and try again.",
    };
  }
  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "Our payment provider is unavailable right now. Please try again in a few minutes.",
  };
}

// Paddle error codes for a charge the customer's payment method couldn't cover.
const PADDLE_PAYMENT_FAILURE_CODES = new Set([
  "subscription_payment_declined",
  "subscription_payment_retry_attempts_exceeded",
  "subscription_missing_payment_method_cannot_update",
  "subscription_missing_payment_method_cannot_retry_payment",
  "subscription_update_when_past_due",
]);

/**
 * providerErrorToClient for a failed Paddle call. Paddle rejects a change it can't apply with 400,
 * 409 or 422 and names the reason in `code`. Only payment failures point at the payment method;
 * anything else (a discount it won't apply, a renewal in progress, a pending change) gets a
 * generic message, since updating the card wouldn't help.
 */
export function paddleErrorToClient(
  statusCode: number | null,
  code: string | null = null,
): ClientBillingError {
  if (code && PADDLE_PAYMENT_FAILURE_CODES.has(code)) return providerErrorToClient(422);
  if (statusCode === 400 || statusCode === 409 || statusCode === 422) {
    return {
      code: "BAD_REQUEST",
      message: "We couldn't apply this change. Please try again or contact support.",
    };
  }
  return providerErrorToClient(statusCode);
}

/** `updated_at` from a provider response, or null when it can't be trusted as an ordering marker. */
export function parseProviderUpdatedAt(updatedAt: string | null | undefined): Date | null {
  if (!updatedAt) return null;
  const parsed = new Date(updatedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Lemon Squeezy answers 422 when it rejects a discount code (expired, capped, disabled or unknown). */
export function lemonSqueezyPromoRejected(result: {
  error: Error | null;
  statusCode: number | null;
}) {
  return Boolean(result.error) && result.statusCode === 422;
}

/** Paddle rejects a discount it won't apply with a 4xx whose error code names the discount. */
export function paddlePromoRejected(result: { error: Error | null }) {
  const { error } = result;
  return (
    error instanceof PaddleApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.code.includes("discount")
  );
}

/**
 * Runs a checkout create with the promo code and, when `isPromoRejected` says the provider
 * rejected the code, once more without it, so a dead promo code never blocks upgrades. Any other
 * failure is returned as-is. `discountCode` is the code the returned result was created with.
 */
export async function createCheckoutWithPromoFallback<T>(
  create: (discountCode?: string) => Promise<T>,
  isPromoRejected: (result: T) => boolean,
  discountCode?: string,
  onPromoRejected?: (result: T) => void,
): Promise<{ result: T; discountCode?: string }> {
  const result = await create(discountCode);
  if (!discountCode || !isPromoRejected(result)) return { result, discountCode };

  onPromoRejected?.(result);
  return { result: await create(undefined), discountCode: undefined };
}

/**
 * Pauses payment collection until `resumesAt`. `void` skips the invoices in between, so nothing
 * is owed for the paused months.
 */
export function pauseUpdate(resumesAt: Date) {
  return { pause: { mode: "void" as const, resumesAt: resumesAt.toISOString() } };
}

/** The provider change that resumes a paused or a cancelled subscription. */
export function resumeUpdate(status: string | null | undefined) {
  return status === "paused" ? { pause: null } : { cancelled: false };
}

/**
 * The amount a Paddle preview bills today: `grand_total` already has the proration, discounts and
 * any account credit applied. A preview with no immediate transaction or an unreadable total falls
 * back to the prorated wording.
 */
export function paddlePreviewCharge(preview: PaddleSubscriptionPreview): PlanChangeCharge {
  const totals = preview.immediate_transaction?.details.totals;
  if (!totals || !/^-?\d+$/.test(totals.grand_total)) return { type: "prorated" };
  return {
    type: "amount_due",
    amount: Number(totals.grand_total),
    currencyCode: totals.currency_code,
  };
}

import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

export type ClientBillingError = {
  code: TRPC_ERROR_CODE_KEY;
  message: string;
};

/**
 * User-facing message for a failed Lemon Squeezy call. Provider messages are
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
        "Our payment provider couldn't apply this change. Check your payment method under Manage Subscription and try again.",
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

/** `updated_at` from a provider response, or null when it can't be trusted as an ordering marker. */
export function parseProviderUpdatedAt(updatedAt: string | null | undefined): Date | null {
  if (!updatedAt) return null;
  const parsed = new Date(updatedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type ProviderResult = { error: unknown; statusCode: number | null };

/**
 * Runs a checkout create with the promo code and, when the provider rejects the code (422: expired,
 * redemption cap reached, disabled or unknown), once more without it, so a dead promo code never
 * blocks upgrades. Any other failure is returned as-is.
 */
export async function createCheckoutWithPromoFallback<T extends ProviderResult>(
  create: (discountCode?: string) => Promise<T>,
  discountCode?: string,
  onPromoRejected?: (result: T) => void,
): Promise<T> {
  const result = await create(discountCode);
  if (!discountCode || !result.error || result.statusCode !== 422) return result;

  onPromoRejected?.(result);
  return create(undefined);
}

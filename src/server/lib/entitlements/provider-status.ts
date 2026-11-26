import { parseProviderUpdatedAt } from "@/server/api/routers/lemonsqueezy/utils";

export type ProviderSubscriptionState = {
  status: string;
  endsAt: Date | null;
  updatedAt: Date | null;
};

export type ProviderSubscriptionLookup = (
  subscriptionId: number,
) => Promise<ProviderSubscriptionState>;

/** Lemon Squeezy has no subscription with this id (404). */
export class ProviderSubscriptionNotFoundError extends Error {}

/** The subscription's current state at Lemon Squeezy. Throws when it can't be read. */
export const lookupProviderSubscription: ProviderSubscriptionLookup = async (subscriptionId) => {
  // Imported on use: this module is in the API auth path (via grace.ts), which never calls it.
  const [{ getSubscription }, { configureLemonSqueezy }] = await Promise.all([
    import("@lemonsqueezy/lemonsqueezy.js"),
    import("@/lib/config/lemonsqueezy"),
  ]);
  configureLemonSqueezy();
  const { data, error, statusCode } = await getSubscription(subscriptionId);
  if (statusCode === 404) {
    throw new ProviderSubscriptionNotFoundError(`subscription ${subscriptionId} not found`);
  }
  if (error || !data) throw new Error(error?.message ?? "empty subscription response");
  const { status, ends_at, updated_at } = data.data.attributes;
  return {
    status,
    endsAt: ends_at ? new Date(ends_at) : null,
    updatedAt: parseProviderUpdatedAt(updated_at),
  };
};

/**
 * Lemon Squeezy statuses that end a failed renewal for good. The
 * update-payment-method link can't restore an expired subscription, and a
 * cancelled one is no longer retrying the payment.
 */
export function isEndedProviderStatus(status: string): boolean {
  return status === "expired" || status === "cancelled";
}

// Lemon Squeezy statuses for a renewal that failed: retrying, then retries exhausted.
export const FAILED_PAYMENT_STATUSES = ["past_due", "unpaid"];

/**
 * Whether Lemon Squeezy has ended a subscription the local row still holds in
 * `localStatus`. Expired always counts. A cancelled failed renewal is no longer
 * retrying the payment, but a cancelled paid one keeps its plan until `ends_at`.
 */
export function providerEndedSubscription(
  localStatus: string,
  provider: ProviderSubscriptionState,
  now: Date,
): boolean {
  if (provider.status === "expired") return true;
  if (provider.status !== "cancelled") return false;
  return (
    FAILED_PAYMENT_STATUSES.includes(localStatus) || (!!provider.endsAt && provider.endsAt <= now)
  );
}

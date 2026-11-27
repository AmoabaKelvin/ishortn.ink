import { PaddleApiError, getPaddleClient } from "@/lib/paddle/client";
import { normalizePaddleSubscription, paddleSubscriptionSchema } from "@/lib/paddle/normalize";
import { parseProviderUpdatedAt } from "@/server/api/routers/lemonsqueezy/utils";

import type { PaddleClient, PaddleSubscription } from "@/lib/paddle/client";
import type { Subscription } from "@/server/db/schema";

export type ProviderSubscriptionState = {
  status: string;
  endsAt: Date | null;
  updatedAt: Date | null;
};

export type ProviderSubscriptionRef = Pick<
  Subscription,
  "billingProvider" | "subscriptionId" | "providerSubscriptionId"
>;

export type ProviderSubscriptionLookup = (
  sub: ProviderSubscriptionRef,
) => Promise<ProviderSubscriptionState>;

/** The provider has no subscription with this id (404). */
export class ProviderSubscriptionNotFoundError extends Error {}

/** The row's provider isn't configured in this environment, so it can't be checked. */
export class ProviderNotConfiguredError extends Error {}

/**
 * A Paddle subscription in the app's (Lemon Squeezy) status vocabulary: `canceled` reads as
 * `expired`, a scheduled cancel as `cancelled` with its end date.
 */
export function paddleSubscriptionState(sub: PaddleSubscription): ProviderSubscriptionState {
  const normalized = normalizePaddleSubscription(paddleSubscriptionSchema.parse(sub));
  return {
    status: normalized.status,
    endsAt: normalized.endsAt,
    updatedAt: normalized.providerUpdatedAt,
  };
}

async function lookupPaddleSubscription(
  id: string,
  client: Pick<PaddleClient, "getSubscription"> | null,
): Promise<ProviderSubscriptionState> {
  if (!client) throw new ProviderNotConfiguredError("Paddle is not configured");
  try {
    return paddleSubscriptionState(await client.getSubscription(id));
  } catch (err) {
    if (err instanceof PaddleApiError && err.status === 404) {
      throw new ProviderSubscriptionNotFoundError(`subscription ${id} not found`);
    }
    throw err;
  }
}

async function lookupLemonSqueezySubscription(
  subscriptionId: number,
): Promise<ProviderSubscriptionState> {
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
}

/**
 * The subscription's current state at the provider stored on the row. Throws when it can't be
 * read, and ProviderNotConfiguredError for a Paddle row while Paddle isn't configured.
 */
export async function lookupProviderSubscription(
  sub: ProviderSubscriptionRef,
  paddleClient: Pick<PaddleClient, "getSubscription"> | null = getPaddleClient(),
): Promise<ProviderSubscriptionState> {
  if (sub.billingProvider === "paddle") {
    return lookupPaddleSubscription(sub.providerSubscriptionId ?? "", paddleClient);
  }
  return lookupLemonSqueezySubscription(sub.subscriptionId ?? 0);
}

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

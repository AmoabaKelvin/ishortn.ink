import { getSubscription } from "@lemonsqueezy/lemonsqueezy.js";

import { configureLemonSqueezy } from "@/lib/config/lemonsqueezy";
import { parseProviderUpdatedAt } from "@/server/api/routers/lemonsqueezy/utils";

export type ProviderSubscriptionState = {
  status: string;
  endsAt: Date | null;
  updatedAt: Date | null;
};

export type ProviderSubscriptionLookup = (
  subscriptionId: number,
) => Promise<ProviderSubscriptionState>;

/** The subscription's current state at Lemon Squeezy. Throws when it can't be read. */
export const lookupProviderSubscription: ProviderSubscriptionLookup = async (subscriptionId) => {
  configureLemonSqueezy();
  const { data, error } = await getSubscription(subscriptionId);
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

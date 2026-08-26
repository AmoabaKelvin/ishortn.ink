import { getSubscription } from "@lemonsqueezy/lemonsqueezy.js";

import { configureLemonSqueezy } from "@/lib/config/lemonsqueezy";

/**
 * Rows created before the ordering marker existed have no baseline, so the
 * first delivery we see could be a retry of an old event. Ask Lemon Squeezy
 * for the subscription's current updated_at and use that as the baseline.
 * Returns true when the event is older than what the provider holds, and
 * throws if the provider cannot be reached.
 */
export async function eventIsBehindProvider(
  subscriptionId: number,
  eventUpdatedAt: Date,
): Promise<boolean> {
  configureLemonSqueezy();
  const { data, error } = await getSubscription(subscriptionId);
  if (error || !data) {
    throw new Error(error?.message ?? "empty subscription response");
  }
  const providerUpdatedAt = new Date(data.data.attributes.updated_at);
  if (Number.isNaN(providerUpdatedAt.getTime())) {
    throw new Error("invalid updated_at from provider");
  }
  return eventUpdatedAt < providerUpdatedAt;
}

import { checkoutEventProperties, readAttribution } from "@/lib/billing/attribution";
import { getIntervalFromVariantId, getPlanFromIds } from "@/lib/billing/plans";

import type { LemonsqueezyOrderEvent } from "@/lib/types/lemonsqueezy";

/**
 * The `order_completed` PostHog event for a paid subscription order, with the same plan,
 * interval, discount code and attribution as the `checkout_started` event it completes. Null when
 * the order isn't paid, isn't for a plan, or didn't come from the in-app checkout (no user_id).
 */
export function orderCompletedEvent({ meta, data }: LemonsqueezyOrderEvent) {
  const order = data.attributes;
  const customData = meta.custom_data ?? {};
  const userId = customData.user_id;
  const item = order.first_order_item;
  const plan = getPlanFromIds(item?.variant_id, item?.product_id);
  if (order.status !== "paid" || !userId || !plan) return null;

  return {
    user: { id: userId, email: order.user_email },
    properties: checkoutEventProperties({
      plan,
      interval: getIntervalFromVariantId(item?.variant_id),
      discount_code: customData.discount_code,
      ...readAttribution({ get: (key) => customData[key] }),
      order_id: data.id,
      amount: order.total / 100,
      amount_usd: order.total_usd / 100,
      currency: order.currency,
      test_mode: order.test_mode,
    }),
  };
}

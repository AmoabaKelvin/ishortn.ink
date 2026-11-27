import { getSubscriptionMode } from "@/lib/billing/plans";

import type { PaddleTransaction } from "@/lib/paddle/client";
import type { Subscription } from "@/server/db/schema";

export type CheckoutAccess = "open" | "subscribed";

/**
 * Whether the checkout page may open a transaction. A user with a live subscription only opens
 * transactions on an existing subscription (payment-method updates, past-due recovery): a new
 * subscription checkout left open in another tab would otherwise bill a second subscription.
 * Paddle is only asked about the transaction when the user has a live subscription.
 */
export async function checkoutAccess(
  subscription: Subscription | null | undefined,
  getTransaction: () => Promise<Pick<PaddleTransaction, "subscription_id">>,
): Promise<CheckoutAccess> {
  if (getSubscriptionMode(subscription) === "checkout") return "open";
  const transaction = await getTransaction();
  return transaction.subscription_id ? "open" : "subscribed";
}

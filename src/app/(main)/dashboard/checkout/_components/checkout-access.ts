import { getSubscriptionMode } from "@/lib/billing/plans";

import type { PaddleTransaction } from "@/lib/paddle/client";
import type { Subscription } from "@/server/db/schema";

export type CheckoutAccess = "open" | "subscribed" | "replaced";

/**
 * Whether the checkout page may open a transaction. A user with a live subscription only opens
 * transactions on an existing subscription (payment-method updates, past-due recovery): a new
 * subscription checkout left open in another tab would otherwise bill a second subscription, so
 * for them a failed lookup propagates. Without one, a canceled transaction was replaced by a
 * newer checkout (cancelOpenCheckouts in paddle-checkout.ts), and Paddle's overlay would only
 * fail on payment with "Cannot update immutable transaction".
 */
export async function checkoutAccess(
  subscription: Subscription | null | undefined,
  getTransaction: () => Promise<Pick<PaddleTransaction, "status" | "subscription_id">>,
): Promise<CheckoutAccess> {
  if (getSubscriptionMode(subscription) === "checkout") {
    // Without a live subscription a failed lookup still opens the checkout; Paddle checks the
    // transaction again on payment.
    const transaction = await getTransaction().catch(() => null);
    return transaction?.status === "canceled" ? "replaced" : "open";
  }
  const transaction = await getTransaction();
  return transaction.subscription_id ? "open" : "subscribed";
}

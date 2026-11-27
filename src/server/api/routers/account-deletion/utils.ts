import { TRPCError } from "@trpc/server";

import { logger } from "@/lib/logger";
import { paddleSubscriptionState } from "@/server/lib/entitlements/provider-status";

import type { PaddleClient } from "@/lib/paddle/client";
import type { ProviderSubscriptionState } from "@/server/lib/entitlements/provider-status";

const log = logger.child({ component: "account-deletion" });

export const CANCEL_FAILED_MESSAGE =
  "We couldn't cancel your subscription, so your account was not deleted. Please try again or contact support@ishortn.ink.";

type PaddleCancelClient = Pick<PaddleClient, "cancelSubscription" | "getSubscription">;

/**
 * Ends a Paddle subscription immediately so a deleted account stops billing, returning the state
 * to store. Throws when it can't be confirmed as canceled.
 */
export async function cancelPaddleSubscriptionForDeletion(
  client: PaddleCancelClient | null,
  subscriptionId: string,
  userId: string,
): Promise<ProviderSubscriptionState> {
  if (!client) {
    log.error({ userId, subscriptionId }, "Paddle not configured; can't cancel before deletion");
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: CANCEL_FAILED_MESSAGE });
  }
  try {
    return paddleSubscriptionState(await client.cancelSubscription(subscriptionId, "immediately"));
  } catch (err) {
    // An earlier attempt may have canceled it without recording it here; Paddle refuses to cancel
    // a canceled subscription.
    const current = await client.getSubscription(subscriptionId).catch(() => null);
    if (current?.status === "canceled") return paddleSubscriptionState(current);
    log.error({ err, userId, subscriptionId }, "failed to cancel subscription before deletion");
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: CANCEL_FAILED_MESSAGE });
  }
}

import { PLAN_VARIANT_IDS } from "@/lib/billing/plans";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import type { PaidPlan } from "@/lib/constants/plan-pricing";
import type { Subscription } from "@/server/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SUBSCRIPTION_AGE_MS = 30 * DAY_MS;
const DISMISS_FOR_MS = 60 * DAY_MS;

export type AnnualSwitchOffer = {
  userId: string;
  plan: PaidPlan;
  annualPrice: number;
  /** Twelve months at the monthly price. */
  monthlyYearTotal: number;
  saving: number;
};

type AnnualSwitchInput = {
  subscription:
    | (Pick<Subscription, "userId" | "status" | "variantId" | "billingInterval" | "createdAt"> &
        Partial<Pick<Subscription, "billingProvider" | "providerPriceId">>)
    | null;
  /** Configured Paddle monthly price ids (`paddlePriceId`); null when Paddle isn't configured. */
  paddleMonthlyPriceIds?: Record<PaidPlan, string | null>;
  /** Billing acts on the personal subscription; team workspaces show the owner's plan instead. */
  isTeamWorkspace: boolean;
  restricted: boolean;
  graceActive: boolean;
  /** Another account banner (promo, paused tracking, bounced email) is already showing. */
  otherBannerShown: boolean;
  /** Epoch ms of the last dismissal, or null when never dismissed. */
  dismissedAt: number | null;
  now?: Date;
};

function monthlyPlan(
  subscription: NonNullable<AnnualSwitchInput["subscription"]>,
  paddleMonthlyPriceIds: AnnualSwitchInput["paddleMonthlyPriceIds"],
): PaidPlan | null {
  if (subscription.billingProvider === "paddle") {
    const priceId = subscription.providerPriceId;
    if (!priceId || !paddleMonthlyPriceIds) return null;
    if (priceId === paddleMonthlyPriceIds.pro) return "pro";
    if (priceId === paddleMonthlyPriceIds.ultra) return "ultra";
    return null;
  }
  if (subscription.variantId === PLAN_VARIANT_IDS.pro.monthly) return "pro";
  if (subscription.variantId === PLAN_VARIANT_IDS.ultra.monthly) return "ultra";
  return null;
}

export function isAnnualSwitchDismissed(dismissedAt: number | null, now = new Date()) {
  return dismissedAt !== null && now.getTime() - dismissedAt < DISMISS_FOR_MS;
}

/**
 * The annual-billing offer for a monthly subscriber, or null when the card is hidden. Only the
 * current $8 Pro and $15 Ultra monthly variants (or Paddle prices) qualify: the legacy $5 Pro
 * price would pay more on annual Pro than it does today.
 */
export function annualSwitchOffer({
  subscription,
  isTeamWorkspace,
  restricted,
  graceActive,
  otherBannerShown,
  dismissedAt,
  paddleMonthlyPriceIds,
  now = new Date(),
}: AnnualSwitchInput): AnnualSwitchOffer | null {
  if (!subscription || isTeamWorkspace || restricted || graceActive || otherBannerShown) {
    return null;
  }
  if (subscription.status !== "active" || subscription.billingInterval === "annual") return null;

  const plan = monthlyPlan(subscription, paddleMonthlyPriceIds);
  if (!plan) return null;

  if (!subscription.createdAt) return null;
  if (now.getTime() - subscription.createdAt.getTime() < MIN_SUBSCRIPTION_AGE_MS) return null;
  if (isAnnualSwitchDismissed(dismissedAt, now)) return null;

  const annualPrice = PLAN_PRICES_ANNUAL_USD[plan];
  const monthlyYearTotal = PLAN_PRICES_USD[plan] * 12;
  return {
    userId: subscription.userId,
    plan,
    annualPrice,
    monthlyYearTotal,
    saving: monthlyYearTotal - annualPrice,
  };
}

// Scoped to the user so another account signed in on the same browser still sees its own offer.
export const annualSwitchDismissKey = (userId: string) =>
  `ishortn:annual-switch-dismissed:${userId}`;

import { getActivePromo } from "@/lib/billing/promo";

import type { Plan, SubscriptionMode } from "@/lib/billing/plans";
import type { Promo } from "@/lib/billing/promo";

export type PromoBannerInput = {
  subscription: {
    plan: Plan;
    isTeamWorkspace: boolean;
    subscriptionMode: SubscriptionMode;
  } | null;
  /** An account banner (grace, paused tracking, bounced email, restriction) is already showing. */
  otherBannerShown: boolean;
  now?: Date;
};

/** Whether upgrading would start a new checkout: a Free account in its personal workspace. */
export function canStartCheckout(subscription: NonNullable<PromoBannerInput["subscription"]>) {
  return (
    subscription.plan === "free" &&
    !subscription.isTeamWorkspace &&
    subscription.subscriptionMode === "checkout"
  );
}

/**
 * The promo the dashboard strip advertises, or null when it is hidden: outside the promo window,
 * for anyone whose upgrade would not be a new checkout (paying, or in a team workspace), and when
 * an account banner already shows so the two never stack.
 */
export function promoBannerState({
  subscription,
  otherBannerShown,
  now = new Date(),
}: PromoBannerInput): Promo | null {
  if (!subscription || otherBannerShown) return null;
  if (!canStartCheckout(subscription)) return null;
  return getActivePromo(now);
}

/**
 * The promo in-app upgrade prompts (sidebar, inline analytics links, plan-limit toasts) carry.
 * Unlike the strip it ignores other banners, so the offer still shows where the strip is hidden.
 */
export function upgradeOfferPromo({
  subscription,
  isRestricted,
  now = new Date(),
}: {
  subscription: PromoBannerInput["subscription"];
  isRestricted: boolean;
  now?: Date;
}): Promo | null {
  if (!subscription || isRestricted || !canStartCheckout(subscription)) return null;
  return getActivePromo(now);
}

export function promoBannerHref(promo: Promo) {
  const params = new URLSearchParams({
    utm_source: "app",
    utm_medium: "banner",
    utm_campaign: promo.utmCampaign,
  });
  return `/dashboard/pricing?${params.toString()}`;
}

export const promoDismissKey = (promo: Promo) => `ishortn:promo-dismissed:${promo.code}`;

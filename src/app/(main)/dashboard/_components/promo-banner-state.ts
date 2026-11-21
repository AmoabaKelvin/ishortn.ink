import { getActivePromo } from "@/lib/billing/promo";

import type { Plan, SubscriptionMode } from "@/lib/billing/plans";
import type { Promo } from "@/lib/billing/promo";

type PromoBannerInput = {
  subscription: {
    plan: Plan;
    isTeamWorkspace: boolean;
    subscriptionMode: SubscriptionMode;
  } | null;
  /** An account banner (grace, paused tracking, bounced email, restriction) is already showing. */
  otherBannerShown: boolean;
  now?: Date;
};

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
  if (subscription.plan !== "free" || subscription.isTeamWorkspace) return null;
  if (subscription.subscriptionMode !== "checkout") return null;
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

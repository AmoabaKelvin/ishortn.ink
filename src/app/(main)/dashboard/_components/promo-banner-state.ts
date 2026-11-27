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

/** The grace notice fields the grace-banner offer depends on. */
export type GraceOfferNotice =
  | { type: "team" }
  | {
      type: "account";
      plan: Plan;
      reason: "lapsed" | "over_plan";
      action: "update_payment" | "upgrade";
    };

/**
 * The promo the plan-grace banner offers with a resubscribe button: an account whose paid plan
 * lapsed (not a failed payment, which is fixed on the existing subscription) and whose resubscribe
 * would be a new checkout. The strip and sidebar skip these accounts, so this is their only offer.
 */
export function graceOfferPromo({
  subscription,
  notice,
  isRestricted,
  now = new Date(),
}: {
  subscription: PromoBannerInput["subscription"];
  notice: GraceOfferNotice | null | undefined;
  isRestricted: boolean;
  now?: Date;
}): Promo | null {
  if (!subscription || !notice || isRestricted) return null;
  if (notice.type !== "account" || notice.reason !== "lapsed" || notice.action !== "upgrade") {
    return null;
  }
  if (notice.plan === "free" || subscription.isTeamWorkspace) return null;
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

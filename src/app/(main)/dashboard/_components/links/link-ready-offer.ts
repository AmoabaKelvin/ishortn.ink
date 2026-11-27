import { formatUsd } from "@/lib/billing/pricing";
import { getActivePromo, promoOfferLine, promoPrice } from "@/lib/billing/promo";
import { PLAN_PRICES_ANNUAL_USD } from "@/lib/constants/plan-pricing";

import { canStartCheckout } from "../promo-banner-state";

import type { PromoBannerInput } from "../promo-banner-state";
import type { Promo } from "@/lib/billing/promo";

export const LINK_READY_SOURCE = "link_ready";
export const FIRST_LINK_OWN_DOMAIN_SOURCE = "first_link_own_domain";

const DEFAULT_OFFER =
  "Want links on your own domain? Custom domains and full click history are on Pro.";

type OfferSubscription = NonNullable<PromoBannerInput["subscription"]> & { isRestricted: boolean };

type LinkReadyOfferInput = {
  subscription: OfferSubscription | null;
  now?: Date;
};

const canOffer = (subscription: OfferSubscription | null) =>
  subscription !== null && !subscription.isRestricted && canStartCheckout(subscription);

/**
 * The plan line under the link-ready dialog's QR row, or null when it is hidden: for anyone
 * whose upgrade would not be a new checkout (paying, or in a team workspace) and for restricted
 * accounts, which get no billing offers.
 */
export function linkReadyOffer({ subscription, now = new Date() }: LinkReadyOfferInput) {
  if (!canOffer(subscription)) return null;
  const promo = getActivePromo(now);
  return promo ? promoOfferLine(promo, "Pro") : DEFAULT_OFFER;
}

export type OwnDomainOffer = { title: string; detail: string; promo: Promo | null };

type OwnDomainOfferInput = {
  subscription: (OfferSubscription & { companyEmailDomain: string | null }) | null;
  isFirstLink: boolean;
  now?: Date;
};

/**
 * Takes the plan line's place after a Free user's first link when they signed up with a company
 * address, whose own domain is the clearest reason to upgrade. Null otherwise.
 */
export function ownDomainOffer({
  subscription,
  isFirstLink,
  now = new Date(),
}: OwnDomainOfferInput): OwnDomainOffer | null {
  if (!isFirstLink || !canOffer(subscription) || !subscription?.companyEmailDomain) return null;
  const yearly = PLAN_PRICES_ANNUAL_USD.pro;
  const promo = getActivePromo(now);
  const price = promo
    ? `$${formatUsd(promoPrice(yearly, promo))} for your first year (${promo.label}, ${promo.percentOff}% off), then $${formatUsd(yearly)}/year`
    : `$${formatUsd(yearly)}/year`;
  return {
    title: `Put this on go.${subscription.companyEmailDomain}`,
    detail: `Custom domains are on Pro: ${price}.`,
    promo,
  };
}

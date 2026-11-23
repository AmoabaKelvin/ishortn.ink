import { getActivePromo, promoOfferLine } from "@/lib/billing/promo";

import { canStartCheckout } from "../promo-banner-state";

import type { PromoBannerInput } from "../promo-banner-state";

export const LINK_READY_SOURCE = "link_ready";

const DEFAULT_OFFER =
  "Want links on your own domain? Custom domains and full click history are on Pro.";

type LinkReadyOfferInput = {
  subscription: (PromoBannerInput["subscription"] & { isRestricted: boolean }) | null;
  now?: Date;
};

/**
 * The plan line under the link-ready dialog's QR row, or null when it is hidden: for anyone
 * whose upgrade would not be a new checkout (paying, or in a team workspace) and for restricted
 * accounts, which get no billing offers.
 */
export function linkReadyOffer({ subscription, now = new Date() }: LinkReadyOfferInput) {
  if (!subscription || subscription.isRestricted || !canStartCheckout(subscription)) return null;
  const promo = getActivePromo(now);
  return promo ? promoOfferLine(promo, "Pro") : DEFAULT_OFFER;
}

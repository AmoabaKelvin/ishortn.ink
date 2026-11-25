"use client";

import { createContext, useContext } from "react";

import { promoOfferLine } from "@/lib/billing/promo";
import { cn } from "@/lib/utils";

import type { Promo } from "@/lib/billing/promo";
import type { ReactNode } from "react";

const UpgradeOfferContext = createContext<Promo | null>(null);

/**
 * The promo in-app upgrade prompts advertise, computed by the dashboard layout on the server
 * (`upgradeOfferPromo`) so prompts never read the browser clock.
 */
export function UpgradeOfferProvider({
  promo,
  children,
}: {
  promo: Promo | null;
  children: ReactNode;
}) {
  return <UpgradeOfferContext.Provider value={promo}>{children}</UpgradeOfferContext.Provider>;
}

/** The running promo for accounts that would start a new checkout, else null. */
export function useUpgradeOffer() {
  return useContext(UpgradeOfferContext);
}

/**
 * The offer as a sentence after an inline upgrade prompt, e.g. "Black Friday: Pro is 20% off your
 * first year until Tuesday 1 December." Renders nothing without a promo; only Free accounts get
 * one, so the plan is always Pro.
 */
export function PromoOfferSuffix({ className }: { className?: string }) {
  const promo = useUpgradeOffer();
  if (!promo) return null;
  return (
    <>
      {" "}
      <span className={cn("text-neutral-600 dark:text-neutral-400", className)}>
        {promoOfferLine(promo, "Pro")}
      </span>
    </>
  );
}

"use client";

import { UpgradeCta } from "@/components/upgrade-cta";

import { useUpgradeOffer } from "../../_components/upgrade-offer";

import type { UpgradePromptProperties } from "@/lib/analytics/upgrade-prompt";
import type { UpgradePlan } from "@/lib/billing/upgrade";

type UpgradeTextProps = {
  text?: string;
  /** Where the prompt sits, for upgrade-click analytics. */
  source: string;
  requiredPlan?: UpgradePlan;
  trackingProperties?: Omit<UpgradePromptProperties, "promo">;
};

/**
 * Inline upgrade link for use inside a sentence. Place `<PromoOfferSuffix />` after the sentence:
 * while a promo runs the link is attributed to the offer it shows.
 */
function UpgradeText({ text, source, requiredPlan = "pro", trackingProperties }: UpgradeTextProps) {
  const promo = useUpgradeOffer();
  return (
    <UpgradeCta
      requiredPlan={requiredPlan}
      source={source}
      promo={promo}
      trackingProperties={trackingProperties}
      className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
    >
      {text ?? "Upgrade your subscription"}
    </UpgradeCta>
  );
}

export default UpgradeText;

"use client";

import { UpgradeCta } from "@/components/upgrade-cta";

import type { UpgradePlan } from "@/lib/billing/upgrade";

type UpgradeTextProps = {
  text?: string;
  /** Where the prompt sits, for upgrade-click analytics. */
  source: string;
  requiredPlan?: UpgradePlan;
};

/** Inline upgrade link for use inside a sentence. */
function UpgradeText({ text, source, requiredPlan = "pro" }: UpgradeTextProps) {
  return (
    <UpgradeCta
      requiredPlan={requiredPlan}
      source={source}
      className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
    >
      {text ?? "Upgrade your subscription"}
    </UpgradeCta>
  );
}

export default UpgradeText;

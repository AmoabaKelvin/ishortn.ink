"use client";

import Link from "next/link";

import { trackUpgradeClick, useTrackUpgradeShown } from "@/lib/analytics/upgrade-prompt";
import { buildUpgradeUrl } from "@/lib/billing/upgrade";

import type { UpgradePromptProperties } from "@/lib/analytics/upgrade-prompt";
import type { Promo } from "@/lib/billing/promo";
import type { UpgradePlan } from "@/lib/billing/upgrade";
import type { ComponentProps } from "react";

type UpgradeCtaProps = Omit<ComponentProps<typeof Link>, "href"> & {
  /** The plan that removes the limit; preselected on the pricing page. */
  requiredPlan: UpgradePlan;
  /** Where the prompt sits, for upgrade-click analytics and the pricing reason line. */
  source: string;
  /** False while the CTA is mounted but not on screen (off-canvas, faded out); defers the impression. */
  shown?: boolean;
  /** The promo this prompt shows next to it; adds campaign UTMs and a `promo` analytics property. */
  promo?: Promo | null;
  /** Extra impression and click properties, e.g. what the prompt told the user they're missing. */
  trackingProperties?: Omit<UpgradePromptProperties, "promo">;
};

/**
 * The one upgrade call to action. Style it with `className`, or render it as a
 * button with `<Button asChild><UpgradeCta … /></Button>`.
 */
export function UpgradeCta({
  requiredPlan,
  source,
  shown = true,
  promo,
  trackingProperties,
  onClick,
  ...props
}: UpgradeCtaProps) {
  const properties = promo ? { ...trackingProperties, promo: promo.code } : trackingProperties;
  useTrackUpgradeShown(source, shown, properties);
  return (
    <Link
      {...props}
      href={buildUpgradeUrl(requiredPlan, source, promo)}
      onClick={(event) => {
        trackUpgradeClick(source, properties);
        onClick?.(event);
      }}
    />
  );
}

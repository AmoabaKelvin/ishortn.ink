"use client";

import Link from "next/link";

import { trackUpgradeClick, useTrackUpgradeShown } from "@/lib/analytics/upgrade-prompt";
import { buildUpgradeUrl } from "@/lib/billing/upgrade";

import type { UpgradePlan } from "@/lib/billing/upgrade";
import type { ComponentProps } from "react";

type UpgradeCtaProps = Omit<ComponentProps<typeof Link>, "href"> & {
  /** The plan that removes the limit; preselected on the pricing page. */
  requiredPlan: UpgradePlan;
  /** Where the prompt sits, for upgrade-click analytics and the pricing reason line. */
  source: string;
  /** False while the CTA is mounted but not on screen (off-canvas, faded out); defers the impression. */
  shown?: boolean;
};

/**
 * The one upgrade call to action. Style it with `className`, or render it as a
 * button with `<Button asChild><UpgradeCta … /></Button>`.
 */
export function UpgradeCta({
  requiredPlan,
  source,
  shown = true,
  onClick,
  ...props
}: UpgradeCtaProps) {
  useTrackUpgradeShown(source, shown);
  return (
    <Link
      {...props}
      href={buildUpgradeUrl(requiredPlan, source)}
      onClick={(event) => {
        trackUpgradeClick(source);
        onClick?.(event);
      }}
    />
  );
}

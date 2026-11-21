"use client";

import { groupReferrers } from "@/lib/core/analytics/referrer";

import { ColoredDistributionCard } from "./colored-distribution-card";

type ReferrersCardProps = {
  referers: Record<string, number>;
  totalClicks: number;
};

export function ReferrersCard({ referers, totalClicks }: ReferrersCardProps) {
  return (
    <ColoredDistributionCard
      title="Traffic Sources"
      description="Click distribution by referrers"
      items={groupReferrers(referers)}
      totalClicks={totalClicks}
      color="red"
    />
  );
}

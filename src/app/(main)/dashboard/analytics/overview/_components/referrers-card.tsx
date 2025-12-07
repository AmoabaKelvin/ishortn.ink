"use client";

import { ColoredDistributionCard } from "./colored-distribution-card";

type ReferrersCardProps = {
  referers: Record<string, number>;
  totalClicks: number;
};

export function ReferrersCard({ referers, totalClicks }: ReferrersCardProps) {
  const items = Object.entries(referers).map(([name, clicks]) => ({
    name: name === "null" ? "Direct" : formatReferrer(name),
    clicks,
  }));

  return (
    <ColoredDistributionCard
      title="Traffic Sources"
      description="Click distribution by referrers"
      items={items}
      totalClicks={totalClicks}
    />
  );
}

function formatReferrer(referrer: string): string {
  try {
    const url = new URL(referrer);
    return url.hostname.replace("www.", "");
  } catch {
    return referrer;
  }
}


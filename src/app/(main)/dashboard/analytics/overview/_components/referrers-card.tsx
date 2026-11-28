"use client";

import { useState } from "react";

import {
  REFERRER_VIEWS,
  type ReferrerView,
  referrerViewRows,
} from "../../[alias]/_components/referrers";
import { ColoredDistributionCard, TabSwitcher } from "./colored-distribution-card";

type ReferrersCardProps = {
  referers: Record<string, number>;
  totalClicks: number;
};

export function ReferrersCard({ referers, totalClicks }: ReferrersCardProps) {
  const [currentView, setCurrentView] = useState<ReferrerView>("all");

  return (
    <ColoredDistributionCard
      title="Traffic Sources"
      description="Click distribution by referrers"
      items={referrerViewRows(referers, currentView)}
      totalClicks={totalClicks}
      color="red"
    >
      <TabSwitcher
        currentView={currentView}
        views={[...REFERRER_VIEWS]}
        onChangeView={setCurrentView}
      />
    </ColoredDistributionCard>
  );
}

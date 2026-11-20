"use client";

import { useState } from "react";

import { groupReferrers, isSearchReferrer, isSocialReferrer } from "@/lib/core/analytics/referrer";

import { BarList } from "./bar-list";

type ReferrerStatsProps = {
  referers: Record<string, number>;
  totalClicks: number;
};

export function ReferrerStats({ referers, totalClicks }: ReferrerStatsProps) {
  const [currentView, setCurrentView] = useState<"all" | "social" | "search">("all");

  const filteredRecords = groupReferrers(referers).filter((record) => {
    if (currentView === "social") return isSocialReferrer(record.source);
    if (currentView === "search") return isSearchReferrer(record.source);
    return true;
  });

  return (
    <BarList.BarListTitle title="Traffic Sources" description="Top referrers and traffic sources">
      <BarList.BarListTabViewSwitcher
        currentView={currentView}
        views={["all", "social", "search"]}
        onChangeView={setCurrentView}
      />
      <BarList records={filteredRecords} totalClicks={totalClicks} color="red" />
    </BarList.BarListTitle>
  );
}

export default ReferrerStats;

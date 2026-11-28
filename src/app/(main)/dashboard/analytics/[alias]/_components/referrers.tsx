"use client";

import { useState } from "react";

import {
  DIRECT_SOURCE_DESCRIPTION,
  groupReferrerChannels,
  groupReferrers,
  isEmailReferrer,
  isSearchReferrer,
  isSocialReferrer,
} from "@/lib/core/analytics/referrer";

import { BarList } from "./bar-list";

export const REFERRER_VIEWS = ["all", "channels", "social", "email", "search"] as const;
export type ReferrerView = (typeof REFERRER_VIEWS)[number];

const VIEW_FILTERS = {
  social: isSocialReferrer,
  email: isEmailReferrer,
  search: isSearchReferrer,
};

/** Rows for a Traffic Sources view; the Direct row carries its explanation. */
export function referrerViewRows(referers: Record<string, number>, view: ReferrerView) {
  const rows =
    view === "channels"
      ? groupReferrerChannels(referers)
      : view === "all"
        ? groupReferrers(referers)
        : groupReferrers(referers).filter((row) => VIEW_FILTERS[view](row.source));
  return rows.map((row) =>
    row.source === "direct" ? { ...row, description: DIRECT_SOURCE_DESCRIPTION } : row,
  );
}

type ReferrerStatsProps = {
  referers: Record<string, number>;
  totalClicks: number;
};

export function ReferrerStats({ referers, totalClicks }: ReferrerStatsProps) {
  const [currentView, setCurrentView] = useState<ReferrerView>("all");

  return (
    <BarList.BarListTitle title="Traffic Sources" description="Top referrers and traffic sources">
      <BarList.BarListTabViewSwitcher
        currentView={currentView}
        views={[...REFERRER_VIEWS]}
        onChangeView={setCurrentView}
      />
      <BarList
        records={referrerViewRows(referers, currentView)}
        totalClicks={totalClicks}
        color="red"
      />
    </BarList.BarListTitle>
  );
}

export default ReferrerStats;

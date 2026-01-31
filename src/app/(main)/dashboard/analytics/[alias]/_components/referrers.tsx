"use client";

import { useState } from "react";

import { BarList } from "./bar-list";

type ReferrerStatsProps = {
  referers: Record<string, number>;
  totalClicks: number;
};

export function ReferrerStats({ referers, totalClicks }: ReferrerStatsProps) {
  // Convert referrers record to array format
  const referrerRecordsAsArray = Object.entries(referers).map(
    ([name, clicks]) => ({
      name: name === "null" ? "Direct" : formatReferrer(name),
      clicks: +clicks,
    })
  );

  const [currentView, setCurrentView] = useState<"all" | "social" | "search">(
    "all"
  );

  const handleViewChange = (view: string) => {
    setCurrentView(view as "all" | "social" | "search");
  };

  // Filter referrers based on current view
  const filteredRecords = referrerRecordsAsArray.filter((record) => {
    if (currentView === "all") return true;
    if (currentView === "social") return isSocialMedia(record.name);
    if (currentView === "search") return isSearchEngine(record.name);
    return true;
  });

  return (
    <BarList.BarListTitle
      title="Traffic Sources"
      description="Top referrers and traffic sources"
    >
      <BarList.BarListTabViewSwitcher
        currentView={currentView}
        views={["all", "social", "search"]}
        onChangeView={handleViewChange}
      />
      <BarList records={filteredRecords} totalClicks={totalClicks} color="red" />
    </BarList.BarListTitle>
  );
}

// Helper function to format referrer URLs
function formatReferrer(referrer: string): string {
  try {
    const url = new URL(referrer);
    return url.hostname.replace("www.", "");
  } catch {
    return referrer;
  }
}

// Helper function to check if referrer is a social media site
function isSocialMedia(referrer: string): boolean {
  const socialDomains = [
    "facebook.com",
    "twitter.com",
    "instagram.com",
    "linkedin.com",
    "pinterest.com",
    "reddit.com",
    "t.co",
    "x.com",
  ];
  return socialDomains.some((domain) => referrer.includes(domain));
}

// Helper function to check if referrer is a search engine
function isSearchEngine(referrer: string): boolean {
  const searchDomains = [
    "google.com",
    "bing.com",
    "yahoo.com",
    "duckduckgo.com",
    "baidu.com",
    "yandex.com",
  ];
  return searchDomains.some((domain) => referrer.includes(domain));
}

export default ReferrerStats;

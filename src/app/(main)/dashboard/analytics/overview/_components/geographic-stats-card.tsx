"use client";

import { useState } from "react";

import { ColoredDistributionCard, TabSwitcher } from "./colored-distribution-card";

type GeographicStatsCardProps = {
  clicksPerCountry: Record<string, number>;
  clicksPerCity: Record<string, number>;
  clicksPerContinent: Record<string, number>;
  totalClicks: number;
};

export function GeographicStatsCard({
  clicksPerCountry,
  clicksPerCity,
  clicksPerContinent,
  totalClicks,
}: GeographicStatsCardProps) {
  const [currentView, setCurrentView] = useState<
    "countries" | "cities" | "continents"
  >("countries");

  const recordsMap = {
    countries: Object.entries(clicksPerCountry).map(([name, clicks]) => ({
      name,
      clicks,
    })),
    cities: Object.entries(clicksPerCity).map(([name, clicks]) => ({
      name,
      clicks,
    })),
    continents: Object.entries(clicksPerContinent).map(([name, clicks]) => ({
      name,
      clicks,
    })),
  };

  const views = ["countries", "cities", "continents"];

  return (
    <ColoredDistributionCard
      title="Geographic Distribution"
      description="Click distribution by location"
      items={recordsMap[currentView]}
      totalClicks={totalClicks}
      color="blue"
    >
      <TabSwitcher
        currentView={currentView}
        views={views}
        onChangeView={(view) =>
          setCurrentView(view as "countries" | "cities" | "continents")
        }
      />
    </ColoredDistributionCard>
  );
}

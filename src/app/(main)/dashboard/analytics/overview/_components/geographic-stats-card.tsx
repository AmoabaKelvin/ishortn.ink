"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { ColoredDistributionCard } from "./colored-distribution-card";

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
    >
      <TabViewSwitcher
        currentView={currentView}
        views={views}
        onChangeView={(view) =>
          setCurrentView(view as "countries" | "cities" | "continents")
        }
      />
    </ColoredDistributionCard>
  );
}

type TabViewSwitcherProps = {
  currentView: string;
  views: string[];
  onChangeView: (view: string) => void;
};

function TabViewSwitcher({
  currentView,
  views,
  onChangeView,
}: TabViewSwitcherProps) {
  return (
    <div className="border-b border-gray-200 mb-4">
      <ul className="flex gap-4">
        {views.map((name) => (
          <li key={name}>
            <button
              onClick={() => onChangeView(name.toLowerCase())}
              className={cn(
                "inline-block cursor-pointer border-b-2 border-transparent py-2 text-sm font-medium transition-colors hover:border-gray-300 hover:text-gray-600",
                currentView === name.toLowerCase() &&
                  "border-blue-600 text-blue-600"
              )}
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

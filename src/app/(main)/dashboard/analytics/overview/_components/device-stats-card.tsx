"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { ColoredDistributionCard } from "./colored-distribution-card";

type DeviceStatsCardProps = {
  clicksPerDevice: Record<string, number>;
  clicksPerOS: Record<string, number>;
  clicksPerBrowser: Record<string, number>;
  totalClicks: number;
};

export function DeviceStatsCard({
  clicksPerDevice,
  clicksPerOS,
  clicksPerBrowser,
  totalClicks,
}: DeviceStatsCardProps) {
  const [currentView, setCurrentView] = useState<"devices" | "os" | "browsers">(
    "devices"
  );

  const recordsMap = {
    devices: Object.entries(clicksPerDevice).map(([name, clicks]) => ({
      name,
      clicks,
    })),
    os: Object.entries(clicksPerOS).map(([name, clicks]) => ({
      name,
      clicks,
    })),
    browsers: Object.entries(clicksPerBrowser).map(([name, clicks]) => ({
      name,
      clicks,
    })),
  };

  const views = ["devices", "os", "browsers"];

  return (
    <ColoredDistributionCard
      title="Device & Platform Statistics"
      description="Click distribution by devices, OS, and browsers"
      items={recordsMap[currentView]}
      totalClicks={totalClicks}
    >
      <TabViewSwitcher
        currentView={currentView}
        views={views}
        onChangeView={(view) =>
          setCurrentView(view as "devices" | "os" | "browsers")
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

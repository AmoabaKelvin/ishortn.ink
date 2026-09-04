"use client";

import { useState } from "react";

import { ColoredDistributionCard, TabSwitcher } from "./colored-distribution-card";

type DeviceStatsCardProps = {
  clicksPerDevice: Record<string, number>;
  clicksPerOS: Record<string, number>;
  clicksPerBrowser: Record<string, number>;
  totalClicks: number;
};

type DeviceView = "devices" | "os" | "browsers";

export function DeviceStatsCard({
  clicksPerDevice,
  clicksPerOS,
  clicksPerBrowser,
  totalClicks,
}: DeviceStatsCardProps) {
  const [currentView, setCurrentView] = useState<DeviceView>("devices");

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

  const views: DeviceView[] = ["devices", "os", "browsers"];

  return (
    <ColoredDistributionCard
      title="Device & Platform Statistics"
      description="Click distribution by devices, OS, and browsers"
      items={recordsMap[currentView]}
      totalClicks={totalClicks}
      color="green"
    >
      <TabSwitcher currentView={currentView} views={views} onChangeView={setCurrentView} />
    </ColoredDistributionCard>
  );
}

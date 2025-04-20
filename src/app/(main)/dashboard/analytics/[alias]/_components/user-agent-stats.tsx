"use client";

import { useState } from "react";

import { BarList } from "./bar-list";

type UserAgentStatsProps = {
  clicksPerDevice: Record<string, number>;
  clicksPerOS: Record<string, number>;
  clicksPerBrowser: Record<string, number>;
  clicksPerModel: Record<string, number>;
  totalClicks: number;
};

export function UserAgentStats({
  clicksPerDevice,
  clicksPerOS,
  clicksPerBrowser,
  clicksPerModel,
  totalClicks,
}: UserAgentStatsProps) {
  const deviceRecordsAsArray = converRecordToArray(clicksPerDevice);
  const osRecordsAsArray = converRecordToArray(clicksPerOS);
  const browserRecordsAsArray = converRecordToArray(clicksPerBrowser);
  const modelRecordsAsArray = converRecordToArray(clicksPerModel);

  const [currentView, setCurrentView] = useState<
    "device" | "os" | "browser" | "model"
  >("device");

  const handleViewChange = (view: string) => {
    setCurrentView(view as "device" | "os" | "browser" | "model");
  };

  const recordsMap = {
    device: deviceRecordsAsArray,
    os: osRecordsAsArray,
    browser: browserRecordsAsArray,
    model: modelRecordsAsArray,
  };

  return (
    <BarList.BarListTitle
      title="Clicks Statistics"
      description="Top devices, OS, browsers, and models"
    >
      <BarList.BarListTabViewSwitcher
        currentView={currentView}
        views={["device", "os", "browser", "model"]}
        onChangeView={handleViewChange}
      />
      <BarList records={recordsMap[currentView]} totalClicks={totalClicks} />
    </BarList.BarListTitle>
  );
}

function converRecordToArray(records: Record<string, number>) {
  return Object.entries(records).map(([name, clicks]) => ({
    name,
    clicks: +clicks,
  }));
}

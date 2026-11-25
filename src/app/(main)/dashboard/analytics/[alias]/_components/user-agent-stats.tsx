"use client";

import { useState } from "react";

import { BarList } from "./bar-list";

type UserAgentView = "device" | "os" | "browser" | "model";

const ALL_VIEWS: UserAgentView[] = ["device", "os", "browser", "model"];

type UserAgentStatsProps = {
  clicksPerDevice: Record<string, number>;
  clicksPerOS: Record<string, number>;
  clicksPerBrowser: Record<string, number>;
  clicksPerModel: Record<string, number>;
  totalClicks: number;
  views?: UserAgentView[];
};

export function UserAgentStats({
  clicksPerDevice,
  clicksPerOS,
  clicksPerBrowser,
  clicksPerModel,
  totalClicks,
  views = ALL_VIEWS,
}: UserAgentStatsProps) {
  const deviceRecordsAsArray = converRecordToArray(clicksPerDevice);
  const osRecordsAsArray = converRecordToArray(clicksPerOS);
  const browserRecordsAsArray = converRecordToArray(clicksPerBrowser);
  const modelRecordsAsArray = converRecordToArray(clicksPerModel);

  const [currentView, setCurrentView] = useState<UserAgentView>("device");

  const recordsMap = {
    device: deviceRecordsAsArray,
    os: osRecordsAsArray,
    browser: browserRecordsAsArray,
    model: modelRecordsAsArray,
  };

  return (
    <BarList.BarListTitle
      title="Clicks Statistics"
      description={
        views.includes("model")
          ? "Top devices, OS, browsers, and models"
          : "Top devices, browsers, and OS"
      }
    >
      <BarList.BarListTabViewSwitcher
        currentView={currentView}
        views={views}
        onChangeView={setCurrentView}
      />
      <BarList records={recordsMap[currentView]} totalClicks={totalClicks} color="green" />
    </BarList.BarListTitle>
  );
}

function converRecordToArray(records: Record<string, number>) {
  return Object.entries(records).map(([name, clicks]) => ({
    name,
    clicks: +clicks,
  }));
}

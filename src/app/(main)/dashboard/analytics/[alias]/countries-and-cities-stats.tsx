"use client";

import { useState } from "react";

import BarList from "./_components/bar-list";

type CountriesAndCitiesStatsProps = {
  countriesRecords: Record<string, number>;
  citiesRecords: Record<string, number>;
  totalClicks: number;
};

export function CountriesAndCitiesStats({
  countriesRecords,
  citiesRecords,
  totalClicks,
}: CountriesAndCitiesStatsProps) {
  const countryRecordsAsArray = converRecordToArray(countriesRecords);
  const cityRecordsAsArray = converRecordToArray(citiesRecords);

  const recordsMap = {
    countries: countryRecordsAsArray,
    cities: cityRecordsAsArray,
  };

  const [currentView, setCurrentView] = useState<"countries" | "cities">("countries");

  const handleViewChange = (view: string) => {
    setCurrentView(view as "countries" | "cities");
  };

  return (
    <BarList.BarListTitle title="Countries and cities" description="Top countries and cities">
      <BarList.BarListTabViewSwitcher
        currentView={currentView}
        views={["countries", "cities"]}
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

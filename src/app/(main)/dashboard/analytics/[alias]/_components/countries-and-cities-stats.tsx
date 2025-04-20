"use client";

import { useState } from "react";

import { BarList } from "./bar-list";

type CountriesAndCitiesStatsProps = {
  countriesRecords: Record<string, number>;
  citiesRecords: Record<string, number>;
  continentsRecords: Record<string, number>;
  proUser: boolean;
  totalClicks: number;
};

export function CountriesAndCitiesStats({
  countriesRecords,
  citiesRecords,
  continentsRecords,
  proUser,
  totalClicks,
}: CountriesAndCitiesStatsProps) {
  const countryRecordsAsArray = converRecordToArray(countriesRecords);
  const cityRecordsAsArray = converRecordToArray(citiesRecords);
  const continentRecordsAsArray = converRecordToArray(continentsRecords);

  const recordsMap = {
    countries: countryRecordsAsArray,
    cities: cityRecordsAsArray,
    continents: continentRecordsAsArray,
  };

  const [currentView, setCurrentView] = useState<
    "countries" | "cities" | "continents"
  >("countries");

  const viewsToShow = proUser
    ? ["countries", "cities", "continents"]
    : ["countries", "cities"];

  const handleViewChange = (view: string) => {
    setCurrentView(view as "countries" | "cities" | "continents");
  };

  return (
    <BarList.BarListTitle
      title="Countries and cities"
      description="Top countries and cities"
    >
      <BarList.BarListTabViewSwitcher
        currentView={currentView}
        views={viewsToShow}
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

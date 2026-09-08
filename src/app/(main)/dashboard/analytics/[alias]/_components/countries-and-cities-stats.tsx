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

type GeoView = "countries" | "cities" | "continents";

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

  const [currentView, setCurrentView] = useState<GeoView>("countries");

  const viewsToShow: GeoView[] = proUser
    ? ["countries", "cities", "continents"]
    : ["countries", "cities"];

  return (
    <BarList.BarListTitle title="Countries and cities" description="Top countries and cities">
      <BarList.BarListTabViewSwitcher
        currentView={currentView}
        views={viewsToShow}
        onChangeView={setCurrentView}
      />
      <BarList records={recordsMap[currentView]} totalClicks={totalClicks} color="blue" />
    </BarList.BarListTitle>
  );
}

function converRecordToArray(records: Record<string, number>) {
  return Object.entries(records).map(([name, clicks]) => ({
    name,
    clicks: +clicks,
  }));
}

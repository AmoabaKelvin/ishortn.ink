"use client";

import { useState } from "react";

import { BarList } from "./bar-list";

type CountriesAndCitiesStatsProps = {
  countriesRecords: Record<string, number>;
  citiesRecords: Record<string, number>;
  continentsRecords: Record<string, number>;
  proUser: boolean;
  totalClicks: number;
  /** Overrides the plan's tabs, e.g. countries only on a shared page. */
  views?: GeoView[];
};

type GeoView = "countries" | "cities" | "continents";

export function CountriesAndCitiesStats({
  countriesRecords,
  citiesRecords,
  continentsRecords,
  proUser,
  totalClicks,
  views,
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

  const viewsToShow: GeoView[] =
    views ?? (proUser ? ["countries", "cities", "continents"] : ["countries", "cities"]);

  const showsCities = viewsToShow.includes("cities");

  return (
    <BarList.BarListTitle
      title={showsCities ? "Countries and cities" : "Countries"}
      description={showsCities ? "Top countries and cities" : "Top countries"}
    >
      {viewsToShow.length > 1 && (
        <BarList.BarListTabViewSwitcher
          currentView={currentView}
          views={viewsToShow}
          onChangeView={setCurrentView}
        />
      )}
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

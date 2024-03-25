"use client";

import { Prisma } from "@prisma/client";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { useState } from "react";
import { Bar } from "react-chartjs-2";

import StatBar from "@/components/dashboard/stats/stat-bar";
import StatsSection from "@/components/dashboard/stats/stats-section";
import StatsSwitcher from "@/components/dashboard/stats/stats-switcher";
import { Button } from "@/components/ui/button";

type Link = Prisma.LinkGetPayload<{
  include: {
    linkVisits: true;
  };
}>;

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: ({ raw }: { raw: any }) => `${raw} clicks`,
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      grid: {
        display: false,
      },
    },
  },
};

const LinkAnalyticsStats = ({ link }: { link: Link }) => {
  const [cityOrCountry, setCityOrCountry] = useState<"city" | "country">(
    "country",
  );

  const [selectedDeviceView, setSelectedDeviceView] = useState<
    "device" | "os" | "browser" | "model"
  >("device");

  const clicksAsTimeSeries = link.linkVisits.reduce(
    (acc, { createdAt }) => {
      const date = new Date(createdAt);
      const formattedDate = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      })
        .format(date)
        .replace(".", "");

      if (!acc[formattedDate]) {
        acc[formattedDate] = 0;
      }

      acc[formattedDate] += 1;

      return acc;
    },
    {} as Record<string, number>,
  );

  const data2 = {
    labels: Object.keys(clicksAsTimeSeries),
    datasets: [
      {
        label: "Clicks",
        data: Object.values(clicksAsTimeSeries),
        backgroundColor: "#3b82f6",
        borderColor: "#3b82f6",
        borderWidth: 1,
      },
    ],
  };

  const totalClicks = link.linkVisits.length;
  const totalDevices = link.linkVisits.reduce(
    (acc, { device }) => {
      if (!acc[device]) {
        acc[device] = 0;
      }

      acc[device] += 1;

      return acc;
    },
    {} as Record<string, number>,
  );

  const devices = Object.entries(totalDevices).map(([name, clicks]) => ({
    name,
    clicks,
  }));

  const countries = link.linkVisits.reduce(
    (acc, { country }) => {
      if (!acc[country]) {
        acc[country] = 0;
      }

      acc[country] += 1;

      return acc;
    },
    {} as Record<string, number>,
  );
  // convert the object to an array
  const countriesArray = Object.entries(countries).map(([country, clicks]) => ({
    country,
    clicks,
  }));

  const cities = link.linkVisits.reduce(
    (acc, { city }) => {
      if (!acc[city]) {
        acc[city] = 0;
      }

      acc[city] += 1;

      return acc;
    },
    {} as Record<string, number>,
  );
  // convert the object to an array
  const citiesArray = Object.entries(cities).map(([city, clicks]) => ({
    city,
    clicks,
  }));

  console.log(citiesArray);

  const os = link.linkVisits.reduce(
    (acc, { os }) => {
      if (!acc[os]) {
        acc[os] = 0;
      }

      acc[os] += 1;

      return acc;
    },
    {} as Record<string, number>,
  );
  // convert the object to an array
  const osArray = Object.entries(os).map(([os, clicks]) => ({
    os,
    clicks,
  }));

  const browsers = link.linkVisits.reduce(
    (acc, { browser }) => {
      if (!acc[browser]) {
        acc[browser] = 0;
      }

      acc[browser] += 1;

      return acc;
    },
    {} as Record<string, number>,
  );
  // convert the object to an array
  const browsersArray = Object.entries(browsers).map(([browser, clicks]) => ({
    browser,
    clicks,
  }));

  const models = link.linkVisits.reduce(
    (acc, { model }) => {
      if (!acc[model]) {
        acc[model] = 0;
      }

      acc[model] += 1;

      return acc;
    },
    {} as Record<string, number>,
  );
  // convert the object to an array
  const modelsArray = Object.entries(models).map(([model, clicks]) => ({
    model,
    clicks,
  }));

  const handleCanvasDownload = () => {
    const canvas = document.querySelector("canvas");
    const link = document.createElement("a");
    link.download = "analytics.png";
    link.href = canvas?.toDataURL() || "";
    link.click();
  };

  const handleViewChange = (view: string) => {
    setSelectedDeviceView(view as "device" | "os" | "browser");
  };

  const handleCountryOrCityChange = (view: string) => {
    setCityOrCountry(view as "city" | "country");
  };

  return (
    <div className="flex flex-col max-w-4xl gap-8 mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold leading-tight text-gray-800 md:text-3xl">
          {/* Link Analytics for{" "} */}
          {/*<span className="text-slate-600">Details for </span>/*/}
          <span className="text-blue-600 cursor-pointer hover:underline">
            ishortn.ink/{link.alias}
          </span>
        </h1>

        {/* Download button */}
        <Button onClick={handleCanvasDownload} variant={"secondary"}>
          Download as PNG
        </Button>
      </div>
      {/* Countries box */}
      <div className="">
        <Bar data={data2} options={options} className="h-96" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-10">
        {/* Countries */}

        <StatsSection
          title="Countries"
          description="See what countries your clicks are coming from"
        >
          <StatsSwitcher
            currentView={cityOrCountry}
            setCurrentView={handleCountryOrCityChange}
            views={["Country", "City"]}
          />

          {/* Render the countries or cities here */}
          {cityOrCountry === "country" ? (
            <>
              {countriesArray.map(({ country, clicks }, index) => (
                <StatBar
                  name={country}
                  clicks={clicks}
                  totalClicks={totalClicks}
                  key={index}
                />
              ))}
            </>
          ) : (
            <>
              {citiesArray.map(({ city, clicks }) => (
                <StatBar
                  name={city}
                  clicks={clicks}
                  totalClicks={totalClicks}
                  key={city}
                />
              ))}
            </>
          )}
        </StatsSection>

        {/* Devices */}
        <StatsSection
          title="Devices"
          description="See what devices your clicks are coming from"
        >
          <StatsSwitcher
            currentView={selectedDeviceView}
            setCurrentView={handleViewChange}
            views={["Device", "OS", "Browser", "Model"]}
          />
          {/* Render the devices, OS, browsers, or models here */}
          {selectedDeviceView === "device" ? (
            <>
              {devices.map(({ name, clicks }) => (
                <StatBar
                  name={name}
                  clicks={clicks}
                  totalClicks={totalClicks}
                  key={name}
                />
              ))}
            </>
          ) : selectedDeviceView === "os" ? (
            <>
              {osArray.map(({ os, clicks }) => (
                <StatBar
                  name={os}
                  clicks={clicks}
                  totalClicks={totalClicks}
                  key={os}
                />
              ))}
            </>
          ) : selectedDeviceView === "browser" ? (
            <>
              {browsersArray.map(({ browser, clicks }) => (
                <StatBar
                  name={browser}
                  clicks={clicks}
                  totalClicks={totalClicks}
                  key={browser}
                />
              ))}
            </>
          ) : selectedDeviceView === "model" ? (
            <>
              {modelsArray.map(({ model, clicks }) => (
                <StatBar
                  name={model}
                  clicks={clicks}
                  totalClicks={totalClicks}
                  key={model}
                />
              ))}
            </>
          ) : null}
        </StatsSection>
      </div>
    </div>
  );
};

export default LinkAnalyticsStats;

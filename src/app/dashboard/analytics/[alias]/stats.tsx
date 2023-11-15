"use client";

import { Button } from "@/components/ui/button";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";

import { Bar } from "react-chartjs-2";

import { Prisma } from "@prisma/client";

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
  Legend
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
    {} as Record<string, number>
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
    {} as Record<string, number>
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
    {} as Record<string, number>
  );
  // convert the object to an array
  const countriesArray = Object.entries(countries).map(([country, clicks]) => ({
    country,
    clicks,
  }));

  const handleCanvasDownload = () => {
    const canvas = document.querySelector("canvas");
    const link = document.createElement("a");
    link.download = "analytics.png";
    link.href = canvas?.toDataURL() || "";
    link.click();
  };

  return (
    <div className="flex flex-col max-w-4xl gap-8 mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold leading-tight text-gray-800">
          {/* Link Analytics for{" "} */}
          <span className="text-slate-600">Details for </span>
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
        <div className="flex flex-col gap-4 p-6 rounded-md bg-gray-50 h-max md:col-span-5">
          <div>
            <h1 className="text-xl font-semibold leading-tight text-gray-800">
              Countries
            </h1>
            <p className="text-sm text-gray-500">
              See where your clicks are coming from
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {countriesArray.map(({ country, clicks }) => (
              <div
                key={country}
                className="relative flex items-center justify-between gap-2 px-1 rounded-md"
              >
                {/* Heading */}
                <span className="z-50 text-base font-semibold text-gray-600">
                  {country}
                </span>
                <div className="flex items-center gap-2">
                  <span className="z-50 text-base font-bold text-black">
                    {clicks}
                  </span>

                  <div className="w-px h-4 bg-gray-300" />

                  <span className="text-sm text-gray-500">
                    {((clicks / totalClicks) * 100).toFixed(0)}%
                  </span>
                </div>

                {/* An absolutely positioned box  whose width will be the percentage of clicks of the country */}
                <div
                  className="absolute top-0 left-0 h-full bg-blue-100 rounded-sm"
                  style={{ width: `${(clicks / totalClicks) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Devices */}
        <div className="flex flex-col gap-4 p-6 rounded-md bg-gray-50 h-max md:col-span-5">
          <div>
            <h1 className="text-xl font-semibold leading-tight text-gray-800">
              Devices
            </h1>
            <p className="text-sm text-gray-500">
              See what devices your clicks are coming from
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {devices.map(({ name, clicks }) => (
              <div
                key={name}
                className="relative flex items-center justify-between px-1 rounded-md gap-"
              >
                <span className="z-50 text-base font-semibold text-gray-600">
                  {name[0].toUpperCase() + name.slice(1)}
                </span>

                <div className="flex items-center gap-2">
                  <span className="z-50 text-base font-bold text-black">
                    {clicks}
                  </span>

                  <div className="w-px h-4 bg-gray-300" />

                  <span className="text-sm text-gray-500">
                    {((clicks / totalClicks) * 100).toFixed(0)}%
                  </span>

                  {/* An absolutely positioned box  whose width will be the percentage of clicks of the country */}
                  <div
                    className="absolute top-0 left-0 h-full bg-blue-100 rounded-sm"
                    style={{ width: `${(clicks / totalClicks) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkAnalyticsStats;

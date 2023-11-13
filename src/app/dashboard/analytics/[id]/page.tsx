"use client";

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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);
const data = [
  { country: "Ghana", clicks: 3 },
  { country: "United States", clicks: 2 },
  { country: "Canada", clicks: 2 },
  { country: "Mexico", clicks: 7 },
  { country: "Brazil", clicks: 2 },
  { country: "Argentina", clicks: 1 },
  { country: "Germany", clicks: 4 },
  // { country: "France", clicks: 8 },
  // { country: "Italy", clicks: 9 },
  // { country: "Australia", clicks: 1 },
  // { country: "New Zealand", clicks: 2 },
  // { country: "Japan", clicks: 1 },
];

const devices = [
  { name: "Windows", clicks: 10 },
  { name: "Android", clicks: 15 },
  { name: "iPhone", clicks: 12 },
  { name: "Mac", clicks: 8 },
  { name: "Linux", clicks: 5 },
  { name: "Other", clicks: 2 },
];

const totalClicks = data.reduce((acc, { clicks }) => acc + clicks, 0);
const totalDevices = devices.reduce((acc, { clicks }) => acc + clicks, 0);

const startDate = new Date("2021-07-01");
const analytics = Array.from({ length: 20 }, (_, i) => {
  const date = new Date(startDate);
  date.setDate(date.getDate() + i);
  return {
    date: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    })
      .format(date)
      .replace(".", ""),

    clicks: Math.floor(Math.random() * 100) + 1,
  };
});

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

const data2 = {
  labels: analytics.map(({ date }) => date),
  datasets: [
    {
      label: "Clicks",
      data: analytics.map(({ clicks }) => clicks),
      backgroundColor: "#3b82f6",
      borderColor: "#3b82f6",
      borderWidth: 1,
    },
  ],
};

const LinkAnalyticsPage = ({ params }: { params: { id: string } }) => {
  return (
    <div className="flex flex-col max-w-4xl gap-8 mx-auto">
      <h1 className="text-3xl font-semibold leading-tight text-gray-800">
        {/* Link Analytics for{" "} */}
        <span className="text-blue-600 cursor-pointer hover:underline">
          <span className="text-slate-600">Details for </span>
          ishortn.ink/{params.id}
        </span>
      </h1>
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
            {data.map(({ country, clicks }) => (
              <div
                key={country}
                className="relative flex items-center justify-between gap-2 px-1 rounded-md"
              >
                <span className="z-50 text-base font-semibold text-gray-600">
                  {country}
                </span>
                <span className="z-50 text-base font-bold text-black">
                  {clicks}
                </span>

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
                  {name}
                </span>
                <span className="z-50 text-base font-bold text-black">
                  {clicks}
                </span>

                {/* An absolutely positioned box  whose width will be the percentage of clicks of the country */}
                <div
                  className="absolute top-0 left-0 h-full bg-blue-100 rounded-sm"
                  style={{ width: `${(clicks / totalDevices) * 100}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LinkAnalyticsPage;

import React from "react";
import Card from "./card";
import DashboardTable from "./table";
import { Card as TremorCard, BarChart, DonutChart } from "@tremor/react";

const chartData = [
  {
    name: "https://www.google.com",
    "Total Number of Clicks": 4000,
  },
  {
    name: "https://www.facebook.com",
    "Total Number of Clicks": 3000,
  },
  {
    name: "https://www.twitter.com",
    "Total Number of Clicks": 2000,
  },
  {
    name: "https://www.youtube.com",
    "Total Number of Clicks": 2780,
  },
  {
    name: "https://www.linkedin.com",
    "Total Number of Clicks": 1890,
  },
];

const topReferrals = [
  {
    name: "X.com",
    referrals: 12400,
  },
  {
    name: "ycombinator.com",
    referrals: 3000,
  },
  {
    name: "google.com",
    referrals: 2000,
  },
  {
    name: "facebook.com",
    referrals: 2780,
  },
];

const Dashboard = () => {
  return (
    <>
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">
        Welcome, John Doe!
      </h1>
      <div className="md:space-x-8 flex flex-col gap-8 md:flex-row md:gap-0 my-8">
        <Card title="Links Shortned" content="45" />
        <Card title="Total Clicks" content="455" />
        <Card title="Total Something" content="45" />
      </div>

      {/* section for map on top 3 performing links and top referrals */}
      <section className="flex flex-col md:flex-row gap-8 my-8">
        <div className="rounded-md shadow-md bg-gray-100 p-6 w-full flex flex-col items-center gap-4">
          <span className="text-2xl text-gray-900 font-mazzardRegular">
            Top Performing Links
          </span>
          <BarChart
            className="mt-6"
            index="name"
            categories={["Total Number of Clicks"]}
            colors={["blue"]}
            yAxisWidth={38}
            data={chartData}
          />
        </div>

        <div className="rounded-md shadow-md bg-gray-100 p-6 w-full flex flex-col items-center gap-4">
          <span className="text-2xl text-gray-900 font-mazzardRegular">
            Top Referrals
          </span>
          <DonutChart
            className="mt-6 flex-1"
            data={topReferrals}
            index="name"
            category="referrals"
            colors={["blue", "green", "yellow", "red"]}
            variant="pie"
          />
        </div>
      </section>

      <section className="bg-white flex flex-col gap-3">
        <p className="text-slate-600">Shortened Links History</p>
        <DashboardTable />
      </section>
    </>
  );
};

export default Dashboard;

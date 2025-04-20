"use client";

import {
  Bar,
  CartesianGrid,
  BarChart as RechartsBarChart,
  XAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import UpgradeText from "../../../qrcodes/_components/upgrade-text";

import type { ChartConfig } from "@/components/ui/chart";

const chartConfig = {
  clicks: {
    label: "Clicks",
    color: "#2563eb",
  },
  uniqueClicks: {
    label: "Unique Clicks",
    color: "#60a5fa",
  },
} satisfies ChartConfig;

type BarChartProps = {
  clicksPerDate: Record<string, number>;
  uniqueClicksPerDate: Record<string, number>;
  className: string;
  isProPlan?: boolean;
};

export function BarChart({
  clicksPerDate,
  uniqueClicksPerDate,
  className,
  isProPlan,
}: BarChartProps) {
  const chartData = Object.entries(clicksPerDate).map(([date, clicks]) => ({
    date,
    clicks,
    uniqueClicks: uniqueClicksPerDate[date],
  }));

  return (
    <Card className="py-16">
      <ChartContainer
        config={chartConfig}
        className="w-full h-96 md:h-full md:min-h-96"
      >
        <RechartsBarChart accessibilityLayer data={chartData}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(date: string) => {
              return new Date(date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              });
            }}
          />
          {/* {isDesktop && (
            <YAxis tickLine={false} tickMargin={10} axisLine={false} allowDecimals={false} />
          )} */}
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="clicks" fill="var(--color-clicks)" radius={4} />
          <Bar
            dataKey="uniqueClicks"
            fill="var(--color-uniqueClicks)"
            radius={4}
          />
        </RechartsBarChart>
      </ChartContainer>
      {isProPlan === false && (
        <div className="mt-2 text-sm text-center text-gray-500">
          Showing data for the last 7 days.{" "}
          <UpgradeText text="Upgrade to Pro" /> for full analytics.
        </div>
      )}
    </Card>
  );
}

"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  XAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  clicks: {
    label: "Clicks",
    color: "#3b82f6",
  },
  uniqueClicks: {
    label: "Unique Clicks",
    color: "#10b981",
  },
} satisfies ChartConfig;

type OverallClicksChartProps = {
  clicksPerDate: Record<string, number>;
  uniqueClicksPerDate: Record<string, number>;
};

export function OverallClicksChart({
  clicksPerDate,
  uniqueClicksPerDate,
}: OverallClicksChartProps) {
  const chartData = Object.entries(clicksPerDate).map(([date, clicks]) => ({
    date,
    clicks,
    uniqueClicks: uniqueClicksPerDate[date] ?? 0,
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
                month: "short",
                day: "numeric",
              });
            }}
          />
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
    </Card>
  );
}


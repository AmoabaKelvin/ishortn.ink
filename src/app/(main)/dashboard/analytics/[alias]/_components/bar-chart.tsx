"use client";

import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

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
  className?: string;
};

export function BarChart({ clicksPerDate, uniqueClicksPerDate, className }: BarChartProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const chartData = Object.entries(clicksPerDate).map(([date, clicks]) => ({
    date,
    clicks,
    uniqueClicks: uniqueClicksPerDate[date],
  }));

  return (
    <ChartContainer config={chartConfig} className="h-96 w-full md:h-full md:min-h-96">
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
        {/* <YAxis tickLine={false} tickMargin={10} axisLine={false} /> */}
        {isDesktop && (
          <YAxis tickLine={false} tickMargin={10} axisLine={false} allowDecimals={false} />
        )}
        {/* <YAxis
          dataKey="clicks"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value: number) => formatPrice(value)}
        /> */}
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="clicks" fill="var(--color-clicks)" radius={4} />
        <Bar dataKey="uniqueClicks" fill="var(--color-uniqueClicks)" radius={4} />
      </RechartsBarChart>
    </ChartContainer>
  );
}

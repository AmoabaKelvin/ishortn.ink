"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
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
import { formatChartDate } from "@/lib/utils";

import type { ChartConfig } from "@/components/ui/chart";

const chartConfig = {
  clicks: {
    label: "Clicks",
    color: "#2563eb",
  },
  uniqueClicks: {
    label: "Unique Clicks",
    color: "#93c5fd",
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
  const chartData = useMemo(
    () =>
      Object.entries(clicksPerDate).map(([date, clicks]) => ({
        date,
        clicks,
        uniqueClicks: uniqueClicksPerDate[date] ?? 0,
      })),
    [clicksPerDate, uniqueClicksPerDate]
  );

  const paddedChartData = useMemo(() => {
    if (chartData.length === 1 && chartData[0]) {
      return [
        {
          date: new Date(new Date(chartData[0].date).getTime() - 86400000)
            .toISOString()
            .split("T")[0],
          clicks: 0,
          uniqueClicks: 0,
        },
        ...chartData,
      ];
    }
    return chartData;
  }, [chartData]);

  return (
    <Card className="overflow-hidden rounded-xl border-neutral-200 shadow-none">
      <div className="border-b border-neutral-100 px-5 pb-4 pt-5">
        <div className="space-y-0.5">
          <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900">
            Click Analytics
          </h2>
          <p className="text-[12px] text-neutral-400">
            Aggregated click performance across all your links
          </p>
        </div>
      </div>

      <div className="px-2 pb-5 pt-4 sm:px-5 sm:pt-5">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-72 w-full"
        >
          <RechartsBarChart data={paddedChartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatChartDate}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatChartDate(String(value))}
                  indicator="dashed"
                />
              }
            />
            <Bar dataKey="clicks" fill="var(--color-clicks)" radius={4} />
            <Bar dataKey="uniqueClicks" fill="var(--color-uniqueClicks)" radius={4} />
            <ChartLegend content={<ChartLegendContent />} />
          </RechartsBarChart>
        </ChartContainer>
      </div>
    </Card>
  );
}

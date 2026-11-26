"use client";

import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis } from "recharts";

import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatChartBucket, formatChartBucketLabel } from "@/lib/utils";

import { ChartEmptyState } from "../../[alias]/_components/chart-empty-state";
import { useChartAnimation } from "../../_components/use-chart-animation";

import type { ChartConfig } from "@/components/ui/chart";
import type { ClickSeriesPoint } from "@/lib/core/analytics";

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
  /** Zero-filled buckets from `fillClickSeries`. */
  series: ClickSeriesPoint[];
};

export function OverallClicksChart({ series }: OverallClicksChartProps) {
  const hasClicks = series.some((point) => point.clicks > 0);
  const animate = useChartAnimation();

  return (
    <Card className="overflow-hidden rounded-xl border-neutral-200 dark:border-border shadow-none">
      <div className="border-b border-neutral-100 dark:border-border/50 px-5 pb-4 pt-5">
        <div className="space-y-0.5">
          <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Click Analytics
          </h2>
          <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
            Aggregated click performance across all your links (UTC)
          </p>
        </div>
      </div>

      <div className="px-2 pb-5 pt-4 sm:px-5 sm:pt-5">
        {!hasClicks ? (
          <ChartEmptyState description="Share your links to start seeing data here." />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            <RechartsBarChart data={series}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={formatChartBucket}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatChartBucketLabel(String(value))}
                    indicator="dashed"
                  />
                }
              />
              <Bar
                dataKey="clicks"
                fill="var(--color-clicks)"
                radius={4}
                isAnimationActive={animate}
              />
              <Bar
                dataKey="uniqueClicks"
                fill="var(--color-uniqueClicks)"
                radius={4}
                isAnimationActive={animate}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </RechartsBarChart>
          </ChartContainer>
        )}
      </div>
    </Card>
  );
}

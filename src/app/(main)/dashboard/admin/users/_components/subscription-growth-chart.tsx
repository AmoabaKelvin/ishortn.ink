"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatChartMonth } from "@/lib/utils";

import type { ChartConfig } from "@/components/ui/chart";

const chartConfig = {
  pro: {
    label: "Pro",
    color: "#3b82f6",
  },
  ultra: {
    label: "Ultra",
    color: "#8b5cf6",
  },
} satisfies ChartConfig;

type SubscriptionGrowthChartProps = {
  data: { date: string; pro: number; ultra: number }[] | undefined;
  isLoading: boolean;
};

export function SubscriptionGrowthChart({
  data,
  isLoading,
}: SubscriptionGrowthChartProps) {
  return (
    <Card className="overflow-hidden rounded-xl border-neutral-200 dark:border-border shadow-none">
      <div className="flex flex-col gap-3 border-b border-neutral-100 dark:border-border/50 px-5 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Subscription Growth
          </h2>
          <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
            New paid subscriptions by plan, monthly
          </p>
        </div>
      </div>

      <div className="px-2 pb-5 pt-4 sm:px-5 sm:pt-5">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 dark:border-border border-t-neutral-400 dark:border-t-neutral-500" />
          </div>
        ) : !data ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
              No data available
            </p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-64 w-full"
          >
            <RechartsBarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={formatChartMonth}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                width={32}
                allowDecimals={false}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatChartMonth(String(value))}
                    indicator="dashed"
                  />
                }
              />
              <Bar
                dataKey="pro"
                stackId="plans"
                fill="var(--color-pro)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="ultra"
                stackId="plans"
                fill="var(--color-ultra)"
                radius={[4, 4, 0, 0]}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </RechartsBarChart>
          </ChartContainer>
        )}
      </div>
    </Card>
  );
}

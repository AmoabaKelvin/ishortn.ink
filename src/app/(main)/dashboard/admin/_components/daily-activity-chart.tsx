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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatChartDate, formatChartMonth } from "@/lib/utils";

import type { ChartConfig } from "@/components/ui/chart";

const chartConfig = {
  links: {
    label: "Links Created",
    color: "#2563eb",
  },
  users: {
    label: "New Users",
    color: "#10b981",
  },
  clicks: {
    label: "Clicks",
    color: "#f59e0b",
  },
} satisfies ChartConfig;

type ActivityChartProps = {
  data: { date: string; links: number; users: number; clicks: number }[] | undefined;
  isLoading: boolean;
  granularity: "day" | "month";
  onGranularityChange: (g: "day" | "month") => void;
};

export function ActivityChart({
  data,
  isLoading,
  granularity,
  onGranularityChange,
}: ActivityChartProps) {
  return (
    <Card className="overflow-hidden rounded-xl border-neutral-200 shadow-none">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 pb-4 pt-5">
        <div className="space-y-0.5">
          <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900">
            Activity
          </h2>
          <p className="text-[12px] text-neutral-400">
            Links, users, and clicks over time
          </p>
        </div>
        <Tabs
          value={granularity}
          onValueChange={(v) => onGranularityChange(v as "day" | "month")}
        >
          <TabsList className="h-7">
            <TabsTrigger value="day" className="px-2.5 text-[11px]">
              Daily
            </TabsTrigger>
            <TabsTrigger value="month" className="px-2.5 text-[11px]">
              Monthly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-2 pb-5 pt-4 sm:px-5 sm:pt-5">
        {isLoading || !data ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-400" />
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
                tickFormatter={
                  granularity === "month" ? formatChartMonth : formatChartDate
                }
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
                    labelFormatter={(value) =>
                      granularity === "month"
                        ? formatChartMonth(String(value))
                        : formatChartDate(String(value))
                    }
                    indicator="dashed"
                  />
                }
              />
              <Bar dataKey="links" fill="var(--color-links)" radius={4} />
              <Bar dataKey="users" fill="var(--color-users)" radius={4} />
              <Bar dataKey="clicks" fill="var(--color-clicks)" radius={4} />
              <ChartLegend content={<ChartLegendContent />} />
            </RechartsBarChart>
          </ChartContainer>
        )}
      </div>
    </Card>
  );
}

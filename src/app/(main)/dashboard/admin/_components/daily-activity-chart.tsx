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
import { formatChartDate } from "@/lib/utils";

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
} satisfies ChartConfig;

type DailyActivityChartProps = {
  data: { date: string; links: number; users: number }[];
};

export function DailyActivityChart({ data }: DailyActivityChartProps) {
  return (
    <Card className="overflow-hidden rounded-xl border-neutral-200 shadow-none">
      <div className="border-b border-neutral-100 px-5 pb-4 pt-5">
        <div className="space-y-0.5">
          <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900">
            Daily Activity
          </h2>
          <p className="text-[12px] text-neutral-400">
            Links created and new user signups over the last 14 days
          </p>
        </div>
      </div>

      <div className="px-2 pb-5 pt-4 sm:px-5 sm:pt-5">
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
              tickFormatter={formatChartDate}
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
                  labelFormatter={(value) => formatChartDate(String(value))}
                  indicator="dashed"
                />
              }
            />
            <Bar dataKey="links" fill="var(--color-links)" radius={4} />
            <Bar dataKey="users" fill="var(--color-users)" radius={4} />
            <ChartLegend content={<ChartLegendContent />} />
          </RechartsBarChart>
        </ChartContainer>
      </div>
    </Card>
  );
}

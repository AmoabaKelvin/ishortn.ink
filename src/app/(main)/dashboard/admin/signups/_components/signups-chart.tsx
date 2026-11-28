"use client";

import { useState } from "react";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { z } from "zod";

import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatChartDate } from "@/lib/utils";

import type { ChartConfig } from "@/components/ui/chart";
import type { RouterOutputs } from "@/trpc/shared";

type SignupAttribution = RouterOutputs["admin"]["getSignupAttribution"];

const chartConfig = {
  signups: {
    label: "Signups",
    color: "#2563eb",
  },
  paid: {
    label: "Paid",
    color: "#93c5fd",
  },
} satisfies ChartConfig;

const granularitySchema = z.enum(["day", "week"]);
type Granularity = z.infer<typeof granularitySchema>;

export function SignupsChart({ data }: { data: SignupAttribution }) {
  const [granularity, setGranularity] = useState<Granularity>("day");
  const series = granularity === "day" ? data.daily : data.weekly;

  return (
    <Card className="overflow-hidden rounded-xl border-neutral-200 dark:border-border shadow-none">
      <div className="flex flex-col gap-3 border-b border-neutral-100 dark:border-border/50 px-5 pb-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Signups over time
          </h2>
          <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
            New accounts and those that later subscribed,{" "}
            {granularity === "day" ? "daily" : "weekly"} (UTC)
          </p>
        </div>
        <Tabs value={granularity} onValueChange={(v) => setGranularity(granularitySchema.parse(v))}>
          <TabsList className="h-7">
            <TabsTrigger value="day" className="px-2.5 text-[11px]">
              Daily
            </TabsTrigger>
            <TabsTrigger value="week" className="px-2.5 text-[11px]">
              Weekly
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-2 pb-5 pt-4 sm:px-5 sm:pt-5">
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <RechartsBarChart data={series}>
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
                  labelFormatter={(value) =>
                    granularity === "week"
                      ? `Week of ${formatChartDate(String(value))}`
                      : formatChartDate(String(value))
                  }
                  indicator="dashed"
                />
              }
            />
            <Bar dataKey="signups" fill="var(--color-signups)" radius={4} />
            <Bar dataKey="paid" fill="var(--color-paid)" radius={4} />
            <ChartLegend content={<ChartLegendContent />} />
          </RechartsBarChart>
        </ChartContainer>
      </div>
    </Card>
  );
}

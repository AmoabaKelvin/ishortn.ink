"use client";

import { IconChartAreaLine, IconChartBar } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  XAxis,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn, formatChartBucket, formatChartBucketLabel } from "@/lib/utils";

import { PromoOfferSuffix } from "../../../_components/upgrade-offer";
import UpgradeText from "../../../qrcodes/_components/upgrade-text";
import { useChartAnimation } from "../../_components/use-chart-animation";
import { ChartEmptyState } from "./chart-empty-state";

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

type GeoRuleData = {
  id: number;
  action: "redirect" | "block";
};

type BarChartProps = {
  /** Zero-filled buckets from `fillClickSeries`. */
  series: ClickSeriesPoint[];
  isProPlan?: boolean;
  geoRules?: GeoRuleData[];
  totalVisits?: { matchedGeoRuleId: number | null }[];
  /** Shown under "No clicks yet" when the range has no clicks. */
  emptyDescription?: string;
};

type ChartView = "clicks" | "geotargeting";
type ChartType = "area" | "bar";

/**
 * Custom tooltip component for the geo pie chart.
 * Extracted outside BarChart to avoid recreation on every render.
 */
function GeoChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { percentage: string } }>;
}) {
  if (active && payload && payload.length > 0) {
    const item = payload[0];
    if (!item) return null;
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card px-3 py-2 shadow-md">
        <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground">{item.name}</p>
        <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
          {item.value.toLocaleString()} clicks ({item.payload.percentage}%)
        </p>
      </div>
    );
  }
  return null;
}

export function BarChart({
  series,
  isProPlan,
  geoRules = [],
  totalVisits = [],
  emptyDescription = "Share your link to start seeing data here.",
}: BarChartProps) {
  const [chartView, setChartView] = useState<ChartView>("clicks");
  const [chartType, setChartType] = useState<ChartType>("area");
  const animate = useChartAnimation();

  const hasClicks = series.some((point) => point.clicks > 0);

  // Memoize geo stats calculation
  const geoStats = useMemo(() => {
    const ruleActionMap = new Map<number, "redirect" | "block">();
    geoRules.forEach((rule) => {
      ruleActionMap.set(rule.id, rule.action);
    });

    return totalVisits.reduce(
      (acc, visit) => {
        if (visit.matchedGeoRuleId === null) {
          acc.defaultCount++;
        } else {
          const action = ruleActionMap.get(visit.matchedGeoRuleId);
          if (action === "redirect") {
            acc.redirectCount++;
          } else if (action === "block") {
            acc.blockCount++;
          } else {
            // Orphaned/deleted rule - count as default
            acc.defaultCount++;
          }
        }
        return acc;
      },
      { defaultCount: 0, redirectCount: 0, blockCount: 0 },
    );
  }, [geoRules, totalVisits]);

  const total = totalVisits.length;
  const hasGeoRules = geoRules.length > 0;

  // Memoize geo chart data for pie chart
  const geoChartData = useMemo(
    () =>
      [
        {
          name: "Default",
          value: geoStats.defaultCount,
          color: "#a3a3a3",
          percentage: total > 0 ? ((geoStats.defaultCount / total) * 100).toFixed(1) : "0",
        },
        {
          name: "Redirected",
          value: geoStats.redirectCount,
          color: "#2563eb",
          percentage: total > 0 ? ((geoStats.redirectCount / total) * 100).toFixed(1) : "0",
        },
        {
          name: "Blocked",
          value: geoStats.blockCount,
          color: "#ef4444",
          percentage: total > 0 ? ((geoStats.blockCount / total) * 100).toFixed(1) : "0",
        },
      ].filter((d) => d.value > 0),
    [geoStats, total],
  );

  const views: ChartView[] = hasGeoRules ? ["clicks", "geotargeting"] : ["clicks"];

  return (
    <Card className="overflow-hidden rounded-xl border-neutral-200 dark:border-border shadow-none">
      {/* Header */}
      <div className="border-b border-neutral-100 dark:border-border/50 px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
              {chartView === "clicks" ? "Click Analytics" : "Targeting Overview"}
            </h2>
            <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
              {chartView === "clicks"
                ? "Track your link performance over time (UTC)"
                : "See how targeting rules affect your traffic"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Chart Type Switcher */}
            {chartView === "clicks" && hasClicks && (
              <div className="flex items-center gap-1 rounded-lg bg-neutral-100 dark:bg-muted p-1">
                <button
                  onClick={() => setChartType("area")}
                  className={cn(
                    "rounded-md p-1.5 transition-all duration-150",
                    chartType === "area"
                      ? "bg-white dark:bg-card text-neutral-900 dark:text-foreground shadow-sm"
                      : "text-neutral-400 dark:text-muted-foreground hover:text-neutral-600 dark:hover:text-neutral-300",
                  )}
                  title="Area Chart"
                  aria-label="Area chart"
                  aria-pressed={chartType === "area"}
                >
                  <IconChartAreaLine size={16} stroke={1.5} />
                </button>
                <button
                  onClick={() => setChartType("bar")}
                  className={cn(
                    "rounded-md p-1.5 transition-all duration-150",
                    chartType === "bar"
                      ? "bg-white dark:bg-card text-neutral-900 dark:text-foreground shadow-sm"
                      : "text-neutral-400 dark:text-muted-foreground hover:text-neutral-600 dark:hover:text-neutral-300",
                  )}
                  title="Bar Chart"
                  aria-label="Bar chart"
                  aria-pressed={chartType === "bar"}
                >
                  <IconChartBar size={16} stroke={1.5} />
                </button>
              </div>
            )}

            {/* View Switcher (Clicks/Geo) */}
            {hasGeoRules && (
              <div className="flex items-center gap-1 rounded-lg bg-neutral-100 dark:bg-muted p-1">
                {views.map((view) => (
                  <button
                    key={view}
                    onClick={() => setChartView(view)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
                      chartView === view
                        ? "bg-white dark:bg-card text-neutral-900 dark:text-foreground shadow-sm"
                        : "text-neutral-400 dark:text-muted-foreground hover:text-neutral-600 dark:hover:text-neutral-300",
                    )}
                  >
                    {view === "clicks" ? "Clicks" : "Rules"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="px-2 pb-5 pt-4 sm:px-5 sm:pt-5">
        {chartView === "clicks" && !hasClicks ? (
          <ChartEmptyState description={emptyDescription} />
        ) : chartView === "clicks" ? (
          <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
            {chartType === "area" ? (
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="fillClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-clicks)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-clicks)" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillUniqueClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-uniqueClicks)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-uniqueClicks)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
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
                      indicator="dot"
                    />
                  }
                />
                {/* Overlapping, not stacked: unique clicks are a subset of clicks, so
                    they draw on top. Monotone keeps zero days from dipping below 0. */}
                <Area
                  dataKey="clicks"
                  type="monotone"
                  fill="url(#fillClicks)"
                  stroke="var(--color-clicks)"
                  isAnimationActive={animate}
                />
                <Area
                  dataKey="uniqueClicks"
                  type="monotone"
                  fill="url(#fillUniqueClicks)"
                  stroke="var(--color-uniqueClicks)"
                  isAnimationActive={animate}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            ) : (
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
            )}
          </ChartContainer>
        ) : (
          <div className="flex h-80 flex-col items-center justify-center md:min-h-80">
            <div className="flex w-full flex-col items-center justify-center gap-10 md:flex-row">
              {/* Donut Chart */}
              <div className="h-56 w-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={geoChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {geoChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<GeoChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-3">
                {geoChartData.map((entry) => (
                  <div key={entry.name} className="group flex cursor-default items-center gap-3">
                    <div
                      className="h-2.5 w-2.5 rounded-full transition-transform duration-150 group-hover:scale-125"
                      style={{ backgroundColor: entry.color }}
                    />
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                        {entry.name}
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums text-neutral-600 dark:text-neutral-400">
                        {entry.value.toLocaleString()}
                      </span>
                      <span className="text-[12px] tabular-nums text-neutral-400 dark:text-muted-foreground">
                        {entry.percentage}%
                      </span>
                    </div>
                  </div>
                ))}

                {/* Summary */}
                <div className="mt-2 border-t border-neutral-100 dark:border-border/50 pt-3">
                  <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                    <span className="font-medium text-neutral-600 dark:text-neutral-400">
                      {geoStats.redirectCount + geoStats.blockCount}
                    </span>{" "}
                    of {total} clicks matched targeting rules
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isProPlan === false && (
        <div className="px-5 pb-4 text-center text-[12px] text-neutral-400 dark:text-muted-foreground">
          Showing data for the last 7 days.{" "}
          <UpgradeText text="Upgrade to Pro" source="analytics_chart" /> for full analytics.
          <PromoOfferSuffix />
        </div>
      )}
    </Card>
  );
}

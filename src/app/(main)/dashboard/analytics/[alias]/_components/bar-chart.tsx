"use client";

import { useMemo, useState } from "react";
import { IconChartAreaLine, IconChartBar } from "@tabler/icons-react";
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
import { cn } from "@/lib/utils";

import UpgradeText from "../../../qrcodes/_components/upgrade-text";

import type { ChartConfig } from "@/components/ui/chart";

/**
 * Formats a "YYYY-MM-DD" date string as UTC to prevent timezone shifts.
 * Parses the string manually to avoid local timezone interpretation.
 */
function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year!, month! - 1, day!));
  return utcDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

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
  clicksPerDate: Record<string, number>;
  uniqueClicksPerDate: Record<string, number>;
  className: string;
  isProPlan?: boolean;
  geoRules?: GeoRuleData[];
  totalVisits?: { matchedGeoRuleId: number | null }[];
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
      <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-md">
        <p className="text-[13px] font-medium text-neutral-900">{item.name}</p>
        <p className="text-[12px] text-neutral-500">
          {item.value.toLocaleString()} clicks ({item.payload.percentage}%)
        </p>
      </div>
    );
  }
  return null;
}

export function BarChart({
  clicksPerDate,
  uniqueClicksPerDate,
  className,
  isProPlan,
  geoRules = [],
  totalVisits = [],
}: BarChartProps) {
  const [chartView, setChartView] = useState<ChartView>("clicks");
  const [chartType, setChartType] = useState<ChartType>("area");

  // Memoize chart data transformation
  const chartData = useMemo(
    () =>
      Object.entries(clicksPerDate).map(([date, clicks]) => ({
        date,
        clicks,
        uniqueClicks: uniqueClicksPerDate[date] ?? 0,
      })),
    [clicksPerDate, uniqueClicksPerDate]
  );

  // Memoize padded chart data
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
      { defaultCount: 0, redirectCount: 0, blockCount: 0 }
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
          percentage:
            total > 0
              ? ((geoStats.defaultCount / total) * 100).toFixed(1)
              : "0",
        },
        {
          name: "Redirected",
          value: geoStats.redirectCount,
          color: "#2563eb",
          percentage:
            total > 0
              ? ((geoStats.redirectCount / total) * 100).toFixed(1)
              : "0",
        },
        {
          name: "Blocked",
          value: geoStats.blockCount,
          color: "#ef4444",
          percentage:
            total > 0
              ? ((geoStats.blockCount / total) * 100).toFixed(1)
              : "0",
        },
      ].filter((d) => d.value > 0),
    [geoStats, total]
  );

  const views = hasGeoRules ? ["clicks", "geotargeting"] : ["clicks"];

  return (
    <Card className="overflow-hidden rounded-xl border-neutral-200 shadow-none">
      {/* Header */}
      <div className="border-b border-neutral-100 px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900">
              {chartView === "clicks" ? "Click Analytics" : "Geotargeting Overview"}
            </h2>
            <p className="text-[12px] text-neutral-400">
              {chartView === "clicks"
                ? "Track your link performance over time"
                : "See how geo rules affect your traffic"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Chart Type Switcher */}
            {chartView === "clicks" && (
              <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
                <button
                  onClick={() => setChartType("area")}
                  className={cn(
                    "rounded-md p-1.5 transition-all duration-150",
                    chartType === "area"
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-400 hover:text-neutral-600"
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
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-400 hover:text-neutral-600"
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
              <div className="flex items-center gap-1 rounded-lg bg-neutral-100 p-1">
                {views.map((view) => (
                  <button
                    key={view}
                    onClick={() => setChartView(view as ChartView)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
                      chartView === view
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-400 hover:text-neutral-600"
                    )}
                  >
                    {view === "clicks" ? "Clicks" : "Geo"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="px-2 pb-5 pt-4 sm:px-5 sm:pt-5">
        {chartView === "clicks" ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-72 w-full"
          >
            {chartType === "area" ? (
              <AreaChart data={paddedChartData}>
                <defs>
                  <linearGradient id="fillClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-clicks)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-clicks)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient id="fillUniqueClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-uniqueClicks)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-uniqueClicks)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={formatDate}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => formatDate(String(value))}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="uniqueClicks"
                  type="natural"
                  fill="url(#fillUniqueClicks)"
                  stroke="var(--color-uniqueClicks)"
                  stackId="a"
                />
                <Area
                  dataKey="clicks"
                  type="natural"
                  fill="url(#fillClicks)"
                  stroke="var(--color-clicks)"
                  stackId="a"
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            ) : (
              <RechartsBarChart data={paddedChartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={formatDate}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => formatDate(String(value))}
                      indicator="dashed"
                    />
                  }
                />
                <Bar dataKey="clicks" fill="var(--color-clicks)" radius={4} />
                <Bar dataKey="uniqueClicks" fill="var(--color-uniqueClicks)" radius={4} />
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
                      <span className="text-[13px] font-medium text-neutral-700">
                        {entry.name}
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums text-neutral-600">
                        {entry.value.toLocaleString()}
                      </span>
                      <span className="text-[12px] tabular-nums text-neutral-400">
                        {entry.percentage}%
                      </span>
                    </div>
                  </div>
                ))}

                {/* Summary */}
                <div className="mt-2 border-t border-neutral-100 pt-3">
                  <p className="text-[12px] text-neutral-400">
                    <span className="font-medium text-neutral-600">{geoStats.redirectCount + geoStats.blockCount}</span> of {total} clicks matched geo rules
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isProPlan === false && (
        <div className="px-5 pb-4 text-center text-[12px] text-neutral-400">
          Showing data for the last 7 days.{" "}
          <UpgradeText text="Upgrade to Pro" /> for full analytics.
        </div>
      )}
    </Card>
  );
}

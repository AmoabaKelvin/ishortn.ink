"use client";

import { IconClick, IconEye, IconTrendingUp, IconUsers } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { Plan } from "@/lib/billing/plans";
import { cn, formatChartDate } from "@/lib/utils";
import { api } from "@/trpc/react";
import type { RouterOutputs } from "@/trpc/shared";

import { QuickInfoCard } from "../../../analytics/[alias]/_components/quick-info-card";

type Analytics = RouterOutputs["bioPage"]["getAnalytics"];

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
] as const;

type Range = (typeof RANGES)[number]["value"];

const chartConfig = {
  views: { label: "Views", color: "#2563eb" },
} satisfies ChartConfig;

export function AnalyticsPanel({ pageId, plan }: { pageId: number; plan: Plan }) {
  const [range, setRange] = useState<Range>("7d");
  const isFree = plan === "free";

  const { data, isLoading, isFetching } = api.bioPage.getAnalytics.useQuery(
    { id: pageId, range },
    {
      // Lazy by design (this tab unmounts when inactive). Keep the previous
      // range's data on screen while a new range loads so switching never
      // flashes a skeleton, and don't refetch aggressively.
      keepPreviousData: true,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 p-1 dark:border-border">
          {RANGES.map((r) => {
            const locked = isFree && r.value !== "7d";
            return (
              <button
                key={r.value}
                disabled={locked}
                onClick={() => setRange(r.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                  range === r.value
                    ? "bg-neutral-900 text-white dark:bg-foreground dark:text-background"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-foreground",
                  locked && "cursor-not-allowed opacity-40 hover:text-neutral-500",
                )}
                title={locked ? "Upgrade to Pro for full analytics history." : undefined}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        {isFree && (
          <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
            Free plans show the last 7 days.
          </p>
        )}
      </div>

      {isLoading || !data ? (
        <AnalyticsSkeleton />
      ) : (
        <div className={cn("space-y-5 transition-opacity", isFetching && "opacity-60")}>
          <StatCards data={data} />
          <ViewsChart viewsPerDay={data.viewsPerDay} />
          <TopLinks perBlock={data.perBlock} />
        </div>
      )}
    </div>
  );
}

function StatCards({ data }: { data: Analytics }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <QuickInfoCard title="Views" value={data.views} icon={<IconEye size={15} stroke={1.5} />} />
      <QuickInfoCard
        title="Unique"
        value={data.uniqueViews}
        icon={<IconUsers size={15} stroke={1.5} />}
      />
      <QuickInfoCard
        title="Clicks"
        value={data.totalClicks}
        icon={<IconClick size={15} stroke={1.5} />}
      />
      <QuickInfoCard
        title="CTR"
        value={`${(data.ctr * 100).toFixed(1)}%`}
        icon={<IconTrendingUp size={15} stroke={1.5} />}
      />
    </div>
  );
}

function ViewsChart({ viewsPerDay }: { viewsPerDay: Record<string, number> }) {
  const chartData = useMemo(() => {
    const entries = Object.entries(viewsPerDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, views]) => ({ date, views }));
    // A single point renders as a flat sliver — pad with a leading zero day.
    if (entries.length === 1 && entries[0]) {
      const prev = new Date(new Date(entries[0].date).getTime() - 86400000)
        .toISOString()
        .split("T")[0]!;
      return [{ date: prev, views: 0 }, ...entries];
    }
    return entries;
  }, [viewsPerDay]);

  return (
    <Card className="overflow-hidden rounded-xl border-neutral-200 shadow-none dark:border-border">
      <div className="border-b border-neutral-100 px-5 pb-4 pt-5 dark:border-border/50">
        <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Views over time
        </h3>
        <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
          Page views across the selected range
        </p>
      </div>
      <div className="px-2 pb-5 pt-4 sm:px-5">
        {chartData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-[13px] text-neutral-400 dark:text-neutral-500">
            No views in this range yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillBioViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-views)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-views)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
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
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="views"
                type="natural"
                fill="url(#fillBioViews)"
                stroke="var(--color-views)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </Card>
  );
}

function TopLinks({ perBlock }: { perBlock: Analytics["perBlock"] }) {
  const max = Math.max(...perBlock.map((b) => b.clicks), 1);
  return (
    <Card className="rounded-xl border-neutral-200 p-5 shadow-none dark:border-border">
      <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
        Top links
      </h3>
      {perBlock.length === 0 ? (
        <p className="mt-3 text-[13px] text-neutral-400 dark:text-neutral-500">
          No link clicks in this range yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {perBlock.map((b) => (
            <div key={b.blockId}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-neutral-700 dark:text-foreground">{b.title}</span>
                <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-foreground">
                  {b.clicks}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                  style={{ width: `${(b.clicks / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[84px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}

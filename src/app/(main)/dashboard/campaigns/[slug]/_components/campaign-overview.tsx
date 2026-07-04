"use client";

import {
  IconClick,
  IconDownload,
  IconScan,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
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

type CampaignData = RouterOutputs["campaign"]["get"];
type Analytics = RouterOutputs["campaign"]["analytics"];

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
] as const;

type Range = (typeof RANGES)[number]["value"];

const chartConfig = {
  clicks: { label: "Clicks", color: "#2563eb" },
  scans: { label: "QR scans", color: "#93c5fd" },
} satisfies ChartConfig;

export function CampaignOverview({
  campaign,
  plan,
}: {
  campaign: CampaignData;
  plan: Plan;
}) {
  const isFree = plan === "free";
  const [range, setRange] = useState<Range>(isFree ? "7d" : "30d");

  const { data, isLoading, isFetching } = api.campaign.analytics.useQuery(
    { id: campaign.id, range },
    {
      keepPreviousData: true,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  if (campaign.links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16 text-center dark:border-border">
        <h3 className="text-[15px] font-medium text-neutral-900 dark:text-foreground">
          No links yet
        </h3>
        <p className="mt-1 max-w-sm text-[13px] text-neutral-400 dark:text-neutral-500">
          Add links or QR codes in the Links tab — their clicks and scans roll up here.
        </p>
      </div>
    );
  }

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

        <div className="flex items-center gap-3">
          {isFree ? (
            <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
              Free plans show the last 7 days.
            </p>
          ) : (
            data && <ExportCsvButton campaign={campaign} analytics={data} />
          )}
        </div>
      </div>

      {isLoading || !data ? (
        <OverviewSkeleton />
      ) : (
        <div className={cn("space-y-5 transition-opacity", isFetching && "opacity-60")}>
          <StatCards data={data} />
          <EngagementChart series={data.series} />
          <div className="grid gap-5 lg:grid-cols-2">
            <TopLinksCard links={data.links} totalEngagements={data.totals.engagements} />
            <ChannelsCard channels={data.channels} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <BreakdownCard title="Countries" entries={data.countries} />
            <BreakdownCard title="Devices" entries={data.devices} />
            <BreakdownCard title="Referrers" entries={data.referrers} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCards({ data }: { data: Analytics }) {
  const { engagements, prevEngagements, clicks, scans, uniqueVisitors } = data.totals;
  const growth =
    prevEngagements > 0 ? ((engagements - prevEngagements) / prevEngagements) * 100 : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <QuickInfoCard
        title="Engagements"
        value={engagements}
        icon={<IconTrendingUp size={15} stroke={1.5} />}
        growth={growth}
      />
      <QuickInfoCard
        title="Link clicks"
        value={clicks}
        icon={<IconClick size={15} stroke={1.5} />}
      />
      <QuickInfoCard title="QR scans" value={scans} icon={<IconScan size={15} stroke={1.5} />} />
      <QuickInfoCard
        title="Unique visitors"
        value={uniqueVisitors}
        icon={<IconUsers size={15} stroke={1.5} />}
      />
    </div>
  );
}

function EngagementChart({ series }: { series: Analytics["series"] }) {
  const chartData = useMemo(() => {
    if (series.length === 1 && series[0]) {
      const prev = new Date(new Date(series[0].date).getTime() - 86400000)
        .toISOString()
        .split("T")[0]!;
      return [{ date: prev, clicks: 0, scans: 0 }, ...series];
    }
    return series;
  }, [series]);

  return (
    <Card className="overflow-hidden rounded-xl border-neutral-200 shadow-none dark:border-border">
      <div className="border-b border-neutral-100 px-5 pb-4 pt-5 dark:border-border/50">
        <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Engagement over time
        </h3>
        <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
          Link clicks and QR scans across the selected range
        </p>
      </div>
      <div className="px-2 pb-5 pt-4 sm:px-5">
        {chartData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-[13px] text-neutral-400 dark:text-neutral-500">
            No engagement in this range yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="fillCampaignClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-clicks)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-clicks)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillCampaignScans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-scans)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-scans)" stopOpacity={0.1} />
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
                dataKey="scans"
                type="natural"
                stackId="a"
                fill="url(#fillCampaignScans)"
                stroke="var(--color-scans)"
              />
              <Area
                dataKey="clicks"
                type="natural"
                stackId="a"
                fill="url(#fillCampaignClicks)"
                stroke="var(--color-clicks)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </Card>
  );
}

function TopLinksCard({
  links,
  totalEngagements,
}: {
  links: Analytics["links"];
  totalEngagements: number;
}) {
  const max = Math.max(...links.map((l) => l.clicks), 1);
  const top = links.slice(0, 8);

  return (
    <Card className="rounded-xl border-neutral-200 p-5 shadow-none dark:border-border">
      <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
        Top links
      </h3>
      <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
        Share of all campaign engagement
      </p>
      {top.every((l) => l.clicks === 0) ? (
        <p className="mt-3 text-[13px] text-neutral-400 dark:text-neutral-500">
          No clicks in this range yet.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {top.map((l) => (
            <div key={l.id}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-neutral-700 dark:text-foreground">
                  {l.name || `${l.domain}/${l.alias}`}
                  {l.isQrCode && (
                    <span className="ml-1.5 text-[11px] uppercase tracking-wider text-neutral-400">
                      QR
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-foreground">
                  {l.clicks}
                  {totalEngagements > 0 && (
                    <span className="ml-1.5 text-[11px] font-normal text-neutral-400">
                      {(l.share * 100).toFixed(0)}%
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-muted">
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                  style={{ width: `${(l.clicks / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ChannelsCard({ channels }: { channels: Record<string, number> }) {
  const entries = Object.entries(channels).sort(([, a], [, b]) => b - a);
  const max = Math.max(...entries.map(([, count]) => count), 1);

  return (
    <Card className="rounded-xl border-neutral-200 p-5 shadow-none dark:border-border">
      <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
        Channels
      </h3>
      <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
        Links grouped by their utm_source
      </p>
      {entries.length === 0 || entries.every(([, count]) => count === 0) ? (
        <p className="mt-3 text-[13px] text-neutral-400 dark:text-neutral-500">
          No channel activity yet. Set UTM defaults or per-link sources to compare channels.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {entries.map(([channel, count]) => (
            <div key={channel}>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="truncate text-neutral-700 dark:text-foreground">{channel}</span>
                <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-foreground">
                  {count}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-muted">
                <div
                  className="h-full rounded-full bg-violet-500 transition-[width] duration-300"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function BreakdownCard({ title, entries }: { title: string; entries: Record<string, number> }) {
  const rows = Object.entries(entries).sort(([, a], [, b]) => b - a);
  const max = Math.max(...rows.map(([, count]) => count), 1);

  return (
    <Card className="rounded-xl border-neutral-200 p-5 shadow-none dark:border-border">
      <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-neutral-400 dark:text-neutral-500">No data yet.</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {rows.map(([label, count]) => (
            <div key={label} className="relative overflow-hidden rounded-md">
              <div
                className="absolute inset-y-0 left-0 bg-neutral-100 dark:bg-muted"
                style={{ width: `${(count / max) * 100}%` }}
              />
              <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-[13px]">
                <span className="truncate text-neutral-700 dark:text-foreground">{label}</span>
                <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-foreground">
                  {count}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ExportCsvButton({
  campaign,
  analytics,
}: {
  campaign: CampaignData;
  analytics: Analytics;
}) {
  const handleExport = () => {
    const header = ["Name", "Short link", "Destination", "Type", "Channel", "Clicks", "Share"];
    const channelByLinkId = new Map(
      campaign.links.map((l) => [l.id, l.utmParams?.utm_source ?? ""]),
    );
    // Prefix formula-trigger characters so Excel/Sheets treat user-controlled
    // values (link names, URLs, utm_source) as text, not executable formulas.
    const escape = (value: string) => {
      const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = analytics.links.map((l) =>
      [
        escape(l.name ?? ""),
        escape(`https://${l.domain}/${l.alias ?? ""}`),
        escape(l.url ?? ""),
        l.isQrCode ? "qr" : "link",
        escape(channelByLinkId.get(l.id) ?? ""),
        String(l.clicks),
        `${(l.share * 100).toFixed(1)}%`,
      ].join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `campaign-${campaign.slug}-${analytics.range}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-muted dark:hover:text-foreground"
    >
      <IconDownload size={14} stroke={1.5} />
      Export CSV
    </button>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[84px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

"use client";

import {
  IconArrowDownRight,
  IconArrowUpRight,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { api } from "@/trpc/react";

import { ActivityChart } from "./_components/daily-activity-chart";
import { DateRangePicker } from "./_components/date-range-picker";
import { MonthlyBreakdownCard } from "./_components/monthly-breakdown-card";
import { PeakPeriodsCard } from "./_components/peak-periods-card";
import { SystemHealthCard } from "./_components/system-health-card";
import { TopLinksCard } from "./_components/top-links-card";
import { TopUsersCard } from "./_components/top-users-card";

function getDefault30d() {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function StatCard({
  title,
  value,
  growth,
}: {
  title: string;
  value: string;
  growth?: number | null;
}) {
  return (
    <Card className="rounded-xl border-neutral-200 dark:border-border p-5 shadow-none">
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        {title}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-foreground">
        {value}
      </p>
      {growth !== undefined && growth !== null && (
        <span
          className={`mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium ${
            growth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
          }`}
        >
          {growth >= 0 ? (
            <IconArrowUpRight size={12} stroke={2} />
          ) : (
            <IconArrowDownRight size={12} stroke={2} />
          )}
          {Math.abs(growth)}% vs prev period
        </span>
      )}
    </Card>
  );
}

export default function AdminPage() {
  const [dateRange, setDateRange] = useState(getDefault30d);
  const [granularity, setGranularity] = useState<"day" | "month">("day");

  const { from, to } = dateRange;

  const { data: analytics, isLoading: analyticsLoading } =
    api.admin.getAnalytics.useQuery({ from, to });

  const { data: chartData, isLoading: chartLoading } =
    api.admin.getActivityChart.useQuery({ from, to, granularity });

  const { data: peakData, isLoading: peakLoading } =
    api.admin.getPeakPeriods.useQuery({ from, to });

  const { data: monthlyData, isLoading: monthlyLoading } =
    api.admin.getMonthlyBreakdown.useQuery({ from, to });

  const { data: healthData, isLoading: healthLoading } =
    api.admin.getSystemHealth.useQuery();

  const { data: activity, isLoading: activityLoading } =
    api.admin.getRecentActivity.useQuery();
  const { data: recentUsers, isLoading: recentUsersLoading } =
    api.admin.getRecentUsers.useQuery();

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
            Platform overview and moderation tools
          </p>
        </div>
        <DateRangePicker from={from} to={to} onChange={setDateRange} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Links"
          value={analyticsLoading ? "..." : (analytics?.links.toLocaleString() ?? "0")}
          growth={analytics?.linksGrowth ?? null}
        />
        <StatCard
          title="Users"
          value={analyticsLoading ? "..." : (analytics?.users.toLocaleString() ?? "0")}
          growth={analytics?.usersGrowth ?? null}
        />
        <StatCard
          title="Clicks"
          value={analyticsLoading ? "..." : (analytics?.clicks.toLocaleString() ?? "0")}
          growth={analytics?.clicksGrowth ?? null}
        />
        <StatCard
          title="Avg Links/User"
          value={analyticsLoading ? "..." : (analytics?.avgLinksPerUser?.toString() ?? "0")}
        />
      </div>

      {/* Activity chart */}
      <div className="mt-8">
        <ActivityChart
          data={chartData}
          isLoading={chartLoading}
          granularity={granularity}
          onGranularityChange={setGranularity}
        />
      </div>

      {/* Peak Periods + System Health */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PeakPeriodsCard data={peakData} isLoading={peakLoading} />
        <SystemHealthCard data={healthData} isLoading={healthLoading} />
      </div>

      {/* Top Users + Top Links */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopUsersCard from={from} to={to} />
        <TopLinksCard from={from} to={to} />
      </div>

      {/* Monthly Breakdown */}
      <div className="mt-4">
        <MonthlyBreakdownCard data={monthlyData} isLoading={monthlyLoading} />
      </div>

      {/* New users + Recent links */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* New users */}
        <Card className="flex flex-col rounded-xl border-neutral-200 dark:border-border shadow-none">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-border/50 px-5 py-4">
            <p className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
              New Users
            </p>
            <Link
              href="/dashboard/admin/users"
              className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              View all
            </Link>
          </div>
          {recentUsersLoading ? (
            <div className="flex flex-1 items-center justify-center px-5 py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 dark:border-border border-t-neutral-400 dark:border-t-neutral-500" />
            </div>
          ) : !recentUsers || recentUsers.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-5 py-12">
              <p className="text-[13px] text-neutral-400 dark:text-neutral-500">No users yet</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-border/50">
              {recentUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {u.imageUrl ? (
                      <img
                        src={u.imageUrl}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-full bg-neutral-100 dark:bg-muted object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-muted text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                        {u.name ?? "Unnamed"}
                      </p>
                      <p className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                        {u.email}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 pl-4 text-right">
                    <p className="text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
                      {u.linkCount} {u.linkCount === 1 ? "link" : "links"}
                    </p>
                    <p className="text-[11px] text-neutral-300 dark:text-neutral-600">
                      {timeAgo(u.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent links */}
        <Card className="flex flex-col rounded-xl border-neutral-200 dark:border-border shadow-none">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-border/50 px-5 py-4">
            <p className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
              Recent Links
            </p>
            <Link
              href="/dashboard/admin/links"
              className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              View all
            </Link>
          </div>
          {activityLoading ? (
            <div className="flex flex-1 items-center justify-center px-5 py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 dark:border-border border-t-neutral-400 dark:border-t-neutral-500" />
            </div>
          ) : !activity || activity.recentLinks.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-5 py-12">
              <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
                No links created yet
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-border/50">
              {activity.recentLinks.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                      <span className="text-neutral-400 dark:text-neutral-500">{l.domain}/</span>
                      {l.alias}
                    </p>
                    <p className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                      {l.url}
                    </p>
                  </div>
                  <div className="shrink-0 pl-4 text-right">
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                      {l.userEmail}
                    </p>
                    <p className="text-[11px] text-neutral-300 dark:text-neutral-600">
                      {timeAgo(l.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recently blocked */}
      <div className="mt-4">
        <Card className="flex flex-col rounded-xl border-neutral-200 dark:border-border shadow-none">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-border/50 px-5 py-4">
            <p className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
              Recently Blocked
            </p>
            <Link
              href="/dashboard/admin/links"
              className="text-[12px] font-medium text-neutral-400 dark:text-neutral-500 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              View all
            </Link>
          </div>
          {activityLoading ? (
            <div className="flex flex-1 items-center justify-center px-5 py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 dark:border-border border-t-neutral-400 dark:border-t-neutral-500" />
            </div>
          ) : !activity || activity.recentBlocked.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-5 py-12">
              <p className="text-[13px] text-neutral-400 dark:text-neutral-500">No blocked links</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-border/50">
              {activity.recentBlocked.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                      <span className="text-neutral-400 dark:text-neutral-500">{l.domain}/</span>
                      {l.alias}
                    </p>
                    <p className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                      {l.blockedReason}
                    </p>
                  </div>
                  <div className="shrink-0 pl-4 text-right">
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                      {l.userEmail}
                    </p>
                    <p className="text-[11px] text-neutral-300 dark:text-neutral-600">
                      {timeAgo(l.blockedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

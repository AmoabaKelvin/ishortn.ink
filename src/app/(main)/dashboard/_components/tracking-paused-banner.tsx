"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { trackUpgradeClick } from "@/lib/analytics/upgrade-prompt";
import { cn } from "@/lib/utils";

import type { EventTrackingPause } from "@/server/lib/event-usage";

// Counters reset at the start of the month in UTC (the Workers clock), so dates render in UTC to
// keep the server and client output identical.
const formatDay = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

type TrackingPausedBannerProps = {
  pause: EventTrackingPause;
  source: string;
  className?: string;
};

export function TrackingPausedBanner({ pause, source, className }: TrackingPausedBannerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
        className,
      )}
    >
      <IconAlertTriangle size={16} stroke={1.5} className="mt-0.5 shrink-0" />
      <p className="min-w-0">
        Tracking paused on {formatDay(pause.pausedAt)}:{" "}
        <span className="font-medium tabular-nums">{pause.dropped.toLocaleString()}</span>{" "}
        {pause.dropped === 1 ? "visit" : "visits"} went through but{" "}
        {pause.dropped === 1 ? "wasn't" : "weren't"} recorded. Resets {formatDay(pause.resetsAt)}{" "}
        &middot;{" "}
        <Link
          href="/dashboard/pricing"
          onClick={() => trackUpgradeClick(source)}
          className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
        >
          Upgrade
        </Link>
      </p>
    </div>
  );
}

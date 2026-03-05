"use client";

import { IconArrowUpRight } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { cn } from "@/lib/utils";

type SidebarStatsProps = {
  monthlyLinkCount: number;
  userHasPaidPlan: boolean;
  linkLimit: number | null;
  eventUsage?: { count: number; limit: number | null };
  folderUsage?: { count: number; limit: number | null };
  plan: "free" | "pro" | "ultra";
};

export function SidebarStats({
  monthlyLinkCount,
  userHasPaidPlan,
  linkLimit,
  eventUsage,
  plan,
}: SidebarStatsProps) {
  const linkCap = linkLimit ?? undefined;
  const linkLimitValue = linkCap ?? (userHasPaidPlan ? undefined : 30);
  const percentage =
    linkLimitValue != null
      ? Math.min((monthlyLinkCount / (linkLimitValue || 1)) * 100, 100)
      : 0;
  const isNearLimit =
    linkLimitValue != null
      ? monthlyLinkCount >= linkLimitValue * 0.83
      : false;
  const isAtLimit =
    linkLimitValue != null ? monthlyLinkCount >= linkLimitValue : false;

  const eventLimit = eventUsage?.limit ?? undefined;
  const eventCount = eventUsage?.count ?? 0;
  const eventPercentage =
    eventLimit != null
      ? Math.min((eventCount / (eventLimit || 1)) * 100, 100)
      : 0;
  const eventAtLimit =
    eventLimit != null ? eventCount >= eventLimit : false;

  if (userHasPaidPlan) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-neutral-100 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              {plan} plan
            </span>
            <span className="text-[11px] tabular-nums text-neutral-500">
              {monthlyLinkCount} links this month
            </span>
          </div>

          {/* Event usage — only show if limit exists */}
          {eventLimit != null && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span>Events</span>
                <span className="tabular-nums">
                  {eventCount.toLocaleString()} /{" "}
                  {eventLimit.toLocaleString()}
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    eventAtLimit ? "bg-red-500" : "bg-blue-600",
                  )}
                  style={{ width: `${eventPercentage}%` }}
                />
              </div>
              {eventAtLimit && (
                <p className="mt-1.5 text-[11px] text-red-600">
                  Analytics paused until next reset.
                </p>
              )}
            </div>
          )}
        </div>

        {plan === "pro" && (
          <Link
            href="/dashboard/pricing"
            className="flex items-center gap-1 px-1 text-[12px] font-medium text-neutral-400 transition-colors hover:text-neutral-900"
          >
            Upgrade to Ultra
            <IconArrowUpRight size={12} stroke={1.5} />
          </Link>
        )}
      </div>
    );
  }

  // Free plan
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-neutral-100 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Free plan
          </span>
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums",
              isAtLimit ? "text-red-600" : "text-neutral-500",
            )}
          >
            {monthlyLinkCount} / {linkLimitValue} links
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isAtLimit
                ? "bg-red-500"
                : isNearLimit
                  ? "bg-amber-500"
                  : "bg-blue-600",
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isAtLimit && (
          <p className="mt-2 text-[11px] text-red-600">
            Limit reached. Upgrade for more links.
          </p>
        )}
        {isNearLimit && !isAtLimit && (
          <p className="mt-2 text-[11px] text-amber-600">
            Almost at limit. Consider upgrading.
          </p>
        )}
      </div>

      <Link
        href="/dashboard/pricing"
        className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-blue-700"
      >
        Upgrade to Pro
        <IconArrowUpRight size={13} stroke={2} />
      </Link>
    </div>
  );
}

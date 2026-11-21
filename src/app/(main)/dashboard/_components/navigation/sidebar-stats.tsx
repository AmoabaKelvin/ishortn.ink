"use client";

import { IconArrowUpRight } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { trackUpgradeClick } from "@/lib/analytics/upgrade-prompt";
import { cn } from "@/lib/utils";

import { eventsUpgradeTarget, formatResetDay, pricingHighlightHref } from "../tracking-paused";

export type EventUsage = {
  count: number;
  limit: number | null;
  resetsAt?: Date;
  paused?: { dropped: number } | null;
};

function EventMeter({ eventUsage }: { eventUsage: EventUsage }) {
  const { count, limit, resetsAt, paused } = eventUsage;
  if (limit == null) return null;
  const percentage = Math.min((count / (limit || 1)) * 100, 100);
  const atLimit = count >= limit;
  const nearLimit = !atLimit && count >= limit * 0.8;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
        <span>Events</span>
        <span className="tabular-nums">
          {count.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            atLimit ? "bg-red-500" : nearLimit ? "bg-amber-500" : "bg-blue-600",
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {atLimit && (
        <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">
          Analytics paused until next reset.
          {paused && paused.dropped > 0 && (
            <>
              {" "}
              <span className="font-medium tabular-nums">
                {paused.dropped.toLocaleString()}
              </span>{" "}
              {paused.dropped === 1 ? "visit" : "visits"} not recorded.
            </>
          )}
        </p>
      )}
      {nearLimit && (
        <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <span className="tabular-nums">
            {count.toLocaleString()} of {limit.toLocaleString()}
          </span>{" "}
          events used{resetsAt ? `, resets ${formatResetDay(resetsAt)}` : ""}.
        </p>
      )}
    </div>
  );
}

const EVENTS_PAUSED_SOURCE = "sidebar_events_paused";

type SidebarStatsProps = {
  monthlyLinkCount: number;
  userHasPaidPlan: boolean;
  linkLimit: number | null;
  eventUsage?: EventUsage;
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
    linkLimitValue != null ? Math.min((monthlyLinkCount / (linkLimitValue || 1)) * 100, 100) : 0;
  const isNearLimit = linkLimitValue != null ? monthlyLinkCount >= linkLimitValue * 0.83 : false;
  const isAtLimit = linkLimitValue != null ? monthlyLinkCount >= linkLimitValue : false;
  // While tracking is paused the upgrade CTA leads with the event cap: it preselects the next plan.
  const eventsTarget = eventUsage?.paused ? eventsUpgradeTarget(plan) : null;
  const upgradeHref = eventsTarget
    ? pricingHighlightHref(eventsTarget.plan, EVENTS_PAUSED_SOURCE)
    : "/dashboard/pricing";

  if (userHasPaidPlan) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-neutral-100 dark:border-border/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {plan} plan
            </span>
            <span className="text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">
              {monthlyLinkCount} links this month
            </span>
          </div>

          {/* Event usage — only show if limit exists */}
          {eventUsage && <EventMeter eventUsage={eventUsage} />}
        </div>

        {plan === "pro" && (
          <Link
            href={upgradeHref}
            onClick={() => trackUpgradeClick(eventsTarget ? EVENTS_PAUSED_SOURCE : "sidebar_pro")}
            className="flex items-center gap-1 px-1 text-[12px] font-medium text-neutral-400 dark:text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-foreground"
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
      <div className="rounded-lg border border-neutral-100 dark:border-border/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Free plan
          </span>
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums",
              isAtLimit
                ? "text-red-600 dark:text-red-400"
                : "text-neutral-500 dark:text-neutral-400",
            )}
          >
            {monthlyLinkCount} / {linkLimitValue} links
          </span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isAtLimit ? "bg-red-500" : isNearLimit ? "bg-amber-500" : "bg-blue-600",
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isAtLimit && (
          <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">
            Limit reached. Upgrade for more links.
          </p>
        )}
        {isNearLimit && !isAtLimit && (
          <p className="mt-2 text-[11px] text-amber-600">Almost at limit. Consider upgrading.</p>
        )}

        {eventUsage && <EventMeter eventUsage={eventUsage} />}
      </div>

      <Link
        href={upgradeHref}
        onClick={() =>
          trackUpgradeClick(
            eventsTarget
              ? EVENTS_PAUSED_SOURCE
              : isAtLimit
                ? "sidebar_free_at_limit"
                : "sidebar_free",
          )
        }
        className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-blue-700"
      >
        Upgrade to Pro
        <IconArrowUpRight size={13} stroke={2} />
      </Link>
    </div>
  );
}

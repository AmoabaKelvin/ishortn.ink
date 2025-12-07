"use client";

import { ArrowUpRight, Sigma, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  folderUsage,
  plan,
}: SidebarStatsProps) {
  const linkCap = linkLimit ?? undefined;
  const linkLimitValue = linkCap ?? (userHasPaidPlan ? undefined : 30);
  const remaining = linkLimitValue ? Math.max(linkLimitValue - monthlyLinkCount, 0) : Infinity;
  const percentage = linkLimitValue
    ? Math.min((monthlyLinkCount / linkLimitValue) * 100, 100)
    : 0;
  const isNearLimit = linkLimitValue ? monthlyLinkCount >= linkLimitValue * 0.83 : false;
  const isAtLimit = linkLimitValue ? monthlyLinkCount >= linkLimitValue : false;

  const eventLimit = eventUsage?.limit ?? undefined;
  const eventCount = eventUsage?.count ?? 0;
  const eventPercentage = eventLimit ? Math.min((eventCount / eventLimit) * 100, 100) : 0;
  const eventNearLimit = eventLimit ? eventCount >= eventLimit * 0.8 : false;
  const eventAtLimit = eventLimit ? eventCount >= eventLimit : false;

  if (userHasPaidPlan) {
    const isProPlan = plan === "pro";

    return (
      <div className="mx-3 mb-3 space-y-3">
        <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-gray-300 text-gray-600">
              Active
            </Badge>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
            <Sigma size={14} className="text-gray-500" />
            <span className="font-medium">{monthlyLinkCount} links</span> created this month
          </div>
          {eventLimit && (
            <div className="mt-3 space-y-2 rounded-lg bg-white/60 border border-gray-200 p-3">
              <div className="flex items-center justify-between text-xs text-gray-700">
                <span className="font-medium">Events usage</span>
                <span className="font-semibold">
                  {eventCount} / {eventLimit.toLocaleString()}
                </span>
              </div>
              <Progress value={eventPercentage} className="h-2" />
              {eventNearLimit && !eventAtLimit && (
                <p className="text-[11px] text-gray-600">
                  You&apos;re nearing your monthly analytics cap.
                </p>
              )}
              {eventAtLimit && (
                <p className="text-[11px] text-red-700">
                  Analytics paused until next reset or upgrade.
                </p>
              )}
            </div>
          )}
        </div>

        {isProPlan && (
          <Link href="/dashboard/pricing" className="block">
            <Button
              variant="outline"
              className="w-full border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-medium transition-colors"
              size="sm"
            >
              <span>Upgrade to Ultra</span>
              <ArrowUpRight size={14} className="ml-2" />
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-3 mb-3 space-y-3">
      {/* Usage Stats Card */}
      <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200">
                <TrendingUp size={16} className="text-gray-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-gray-300 text-gray-600">
              Active
            </Badge>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600">
                Links remaining
              </span>
              <span
                className={cn(
                  "text-lg font-bold tabular-nums",
                  isAtLimit
                    ? "text-red-600"
                    : isNearLimit
                    ? "text-yellow-600"
                    : "text-gray-900"
                )}
              >
                {Number.isFinite(remaining) ? remaining : "Unlimited"}
              </span>
            </div>
            {linkLimitValue ? (
              <>
                <Progress
                  value={percentage}
                  className={cn(
                    "h-2",
                    isAtLimit
                      ? "[&>div]:bg-red-500"
                      : isNearLimit
                      ? "[&>div]:bg-yellow-500"
                      : "[&>div]:bg-blue-500"
                  )}
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  {monthlyLinkCount} of {linkLimitValue} links used this month
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 mt-1.5">Unlimited links on your plan.</p>
            )}
          </div>

          {/* Warning Messages */}
          {linkLimitValue && (
            <>
              {isAtLimit && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-2.5">
                  <p className="text-xs font-medium text-red-700">
                    ⚠️ Limit reached! Upgrade to Pro for more.
                  </p>
                </div>
              )}
              {isNearLimit && !isAtLimit && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-2.5">
                  <p className="text-xs font-medium text-yellow-700">
                    ⚡ Almost at limit! Upgrade to Pro for more.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {eventLimit && (
        <div className="rounded-xl bg-gradient-to-br from-white to-gray-50 p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                <TrendingUp size={16} className="text-blue-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Analytics usage</p>
                <p className="text-xs text-gray-500">
                  {eventCount} / {eventLimit.toLocaleString()} events
                </p>
              </div>
            </div>
          </div>
          <Progress
            value={eventPercentage}
            className={cn(
              "h-2",
              eventAtLimit
                ? "[&>div]:bg-red-500"
                : eventNearLimit
                ? "[&>div]:bg-yellow-500"
                : "[&>div]:bg-blue-500"
            )}
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Analytics stop recording at the cap; redirects continue.
          </p>
          {eventAtLimit && (
            <div className="mt-2 rounded-lg bg-red-50 border border-red-200 p-2">
              <p className="text-[11px] text-red-700">
                Analytics paused. Upgrade for more events.
              </p>
            </div>
          )}
        </div>
      )}

      {folderUsage?.limit !== null && folderUsage?.limit !== undefined && (
        <div className="rounded-xl border border-gray-200 p-3 bg-white">
          <div className="flex items-center justify-between text-sm text-gray-800">
            <span className="font-semibold">Folders</span>
            <span className="font-semibold">
              {folderUsage.count} / {folderUsage.limit === null ? "∞" : folderUsage.limit}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {folderUsage.limit === 0
              ? "Upgrade to create folders."
              : "Organize links into folders; upgrade for more."}
          </p>
        </div>
      )}

      {/* Upgrade Button */}
      <Link href="/dashboard/pricing" className="block">
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
          size="sm"
        >
          <span>Upgrade to Pro</span>
          <ArrowUpRight size={14} className="ml-2" />
        </Button>
      </Link>
    </div>
  );
}

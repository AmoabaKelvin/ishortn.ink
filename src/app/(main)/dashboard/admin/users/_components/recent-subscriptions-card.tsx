"use client";

import { Card } from "@/components/ui/card";
import { type PaidPlan } from "@/lib/constants/plan-pricing";
import { timeAgo } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/shared";

type Subscription = RouterOutputs["admin"]["getRecentSubscriptions"][number];

const PLAN_BADGE: Record<PaidPlan, string> = {
  pro: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  ultra: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
};

function planBadgeClass(plan: Subscription["plan"]): string | null {
  if (plan === "pro" || plan === "ultra") return PLAN_BADGE[plan];
  return null;
}

export function RecentSubscriptionsCard({
  data,
  isLoading,
}: {
  data: Subscription[] | undefined;
  isLoading: boolean;
}) {
  return (
    <Card className="flex flex-col rounded-xl border-neutral-200 dark:border-border shadow-none">
      <div className="border-b border-neutral-100 dark:border-border/50 px-5 py-4">
        <p className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Recent Subscriptions
        </p>
        <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">
          Latest paid sign-ups
        </p>
      </div>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 dark:border-border border-t-neutral-400 dark:border-t-neutral-500" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <p className="text-[13px] text-neutral-400 dark:text-neutral-500">
            No paid subscriptions yet
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-border/50">
          {data.map((s) => {
            const badgeClass = planBadgeClass(s.plan);
            return (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                {s.userImage ? (
                  <img
                    src={s.userImage}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full bg-neutral-100 dark:bg-muted object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-muted text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    {(s.userName ?? s.userEmail ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    {s.userName ?? "Unnamed"}
                  </p>
                  <p className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                    {s.userEmail}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {badgeClass && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${badgeClass}`}
                    >
                      {s.plan}
                    </span>
                  )}
                  <p className="w-16 text-right text-[11px] text-neutral-400 dark:text-neutral-500">
                    {timeAgo(s.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

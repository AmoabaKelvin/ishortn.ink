"use client";

import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";
import type { RouterOutputs } from "@/trpc/shared";

type TierBreakdown = RouterOutputs["admin"]["getUserBaseSummary"]["tiers"];

const TIER_META = [
  { key: "free", label: "Free", color: "bg-neutral-300 dark:bg-neutral-600" },
  { key: "pro", label: "Pro", color: "bg-blue-500" },
  { key: "ultra", label: "Ultra", color: "bg-violet-500" },
] as const satisfies readonly { key: keyof TierBreakdown; label: string; color: string }[];

export function TierBreakdownCard({
  data,
  isLoading,
}: {
  data: TierBreakdown | undefined;
  isLoading: boolean;
}) {
  return (
    <Card className="flex flex-col rounded-xl border-neutral-200 dark:border-border shadow-none">
      <div className="border-b border-neutral-100 dark:border-border/50 px-5 py-4">
        <p className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Plan Breakdown
        </p>
        <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">
          Distribution across tiers (current)
        </p>
      </div>
      {isLoading || !data ? (
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 dark:border-border border-t-neutral-400 dark:border-t-neutral-500" />
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-border/50">
          {TIER_META.map((meta) => {
            const tier = data[meta.key];
            return (
              <div key={meta.key} className="px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${meta.color}`} />
                    <p className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                      {meta.label}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <p className="text-[13px] font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                      {tier.count.toLocaleString()}
                    </p>
                    <p className="w-12 text-right text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
                      {tier.share}%
                    </p>
                    <p className="w-16 text-right text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
                      {tier.mrr > 0
                        ? `${formatPrice(tier.mrr, { notation: "standard", maximumFractionDigits: 0 })}/mo`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-muted">
                  <div
                    className={`h-full ${meta.color}`}
                    style={{ width: `${Math.min(tier.share, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

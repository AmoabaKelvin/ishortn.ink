"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DistributionItem = {
  name: string;
  clicks: number;
};

type ColoredDistributionCardProps = {
  title: string;
  description: string;
  items: DistributionItem[];
  totalClicks: number;
  color?: "blue" | "green" | "red" | "orange" | "purple";
  maxHeight?: string;
  children?: React.ReactNode;
};

const colorMap = {
  blue: { bg: "bg-blue-50" },
  green: { bg: "bg-emerald-50" },
  red: { bg: "bg-rose-50" },
  orange: { bg: "bg-amber-50" },
  purple: { bg: "bg-violet-50" },
};

export function ColoredDistributionCard({
  title,
  description,
  items,
  totalClicks,
  color = "blue",
  maxHeight = "max-h-[400px]",
  children,
}: ColoredDistributionCardProps) {
  const sortedItems = [...items].sort((a, b) => b.clicks - a.clicks);
  const maxClicks = sortedItems[0]?.clicks ?? 1;

  return (
    <Card className="flex h-full flex-col rounded-xl border-neutral-200 p-5 shadow-none">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="space-y-0.5">
          <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900">
            {title}
          </h2>
          <p className="text-[12px] text-neutral-400">{description}</p>
        </div>
        <span className="pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-300">
          Clicks
        </span>
      </div>

      {/* Optional tab switcher */}
      {children}

      {/* Bar list */}
      <div className={cn("flex flex-col gap-1.5 overflow-y-auto", maxHeight)}>
        {sortedItems.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-[13px] text-neutral-400">
            No data available
          </div>
        ) : (
          sortedItems.map((item) => {
            const percentage = maxClicks > 0 ? (item.clicks / maxClicks) * 100 : 0;
            const percentOfTotal = totalClicks > 0 ? ((item.clicks / totalClicks) * 100).toFixed(0) : "0";

            return (
              <div
                key={item.name}
                className="group relative flex cursor-default items-center justify-between rounded-lg px-3 py-2.5"
              >
                {/* Background bar */}
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-lg transition-all duration-300 ease-out",
                    colorMap[color].bg
                  )}
                  style={{ width: `${percentage}%` }}
                />

                {/* Item name */}
                <span className="relative z-10 truncate pr-4 text-[13px] font-medium text-neutral-700">
                  {item.name}
                </span>

                {/* Stats */}
                <div className="relative z-10 flex items-center gap-2">
                  <span className="text-[13px] font-semibold tabular-nums text-neutral-600">
                    {item.clicks.toLocaleString()}
                  </span>
                  <span className="w-0 overflow-hidden text-[13px] font-medium tabular-nums text-neutral-400 opacity-0 transition-all duration-200 ease-out group-hover:w-10 group-hover:opacity-100">
                    {percentOfTotal}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

/**
 * Pill-style tab switcher matching the individual analytics page pattern.
 */
type TabSwitcherProps = {
  currentView: string;
  views: string[];
  onChangeView: (view: string) => void;
};

export function TabSwitcher({
  currentView,
  views,
  onChangeView,
}: TabSwitcherProps) {
  return (
    <div className="mb-4 flex items-center gap-1 border-b border-neutral-100 pb-2">
      {views.map((name) => (
        <button
          key={name}
          onClick={() => onChangeView(name.toLowerCase())}
          className={cn(
            "relative rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
            currentView === name.toLowerCase()
              ? "bg-neutral-100 text-neutral-900"
              : "text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600"
          )}
        >
          {name.charAt(0).toUpperCase() + name.slice(1)}
        </button>
      ))}
    </div>
  );
}

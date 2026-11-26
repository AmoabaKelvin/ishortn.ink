import { IconInfoCircle } from "@tabler/icons-react";

import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type BarListProps = {
  records: {
    name: string;
    clicks: number;
    /** Explains what the row means; shown in a tooltip beside the name. */
    description?: string;
  }[];
  totalClicks: number;
  color?: "blue" | "green" | "red" | "orange" | "purple";
};

const colorMap = {
  blue: { bg: "bg-blue-50 dark:bg-blue-500/10", accent: "bg-blue-600" },
  green: { bg: "bg-emerald-50 dark:bg-emerald-500/10", accent: "bg-emerald-600" },
  red: { bg: "bg-rose-50 dark:bg-rose-500/10", accent: "bg-rose-600" },
  orange: { bg: "bg-amber-50 dark:bg-amber-500/10", accent: "bg-amber-600" },
  purple: { bg: "bg-violet-50 dark:bg-violet-500/10", accent: "bg-violet-600" },
};

export function BarList({ records, totalClicks, color = "blue" }: BarListProps) {
  const sortedRecords = [...records].sort((a, b) => b.clicks - a.clicks);
  const maxClicks = sortedRecords[0]?.clicks ?? 1;

  if (sortedRecords.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-[13px] text-neutral-400 dark:text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {sortedRecords.map((record) => {
        const percentage = maxClicks > 0 ? (record.clicks / maxClicks) * 100 : 0;
        const percentOfTotal =
          totalClicks > 0 ? ((record.clicks / totalClicks) * 100).toFixed(0) : "0";
        return (
          <div
            key={record.name}
            className="group relative flex items-center justify-between rounded-lg px-3 py-2.5 cursor-default"
          >
            {/* Background bar */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-lg transition-all duration-300 ease-out",
                colorMap[color].bg,
              )}
              style={{ width: `${percentage}%` }}
            />

            {/* Item name */}
            <div className="relative z-10 flex min-w-0 items-center gap-1.5 pr-4">
              <span className="truncate text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                {record.name}
              </span>
              {record.description && <RowHint label={record.name} text={record.description} />}
            </div>

            {/* Stats */}
            <div className="relative z-10 flex items-center gap-2">
              <span className="text-[13px] font-semibold tabular-nums text-neutral-600 dark:text-neutral-400">
                {record.clicks.toLocaleString()}
              </span>
              <span className="w-0 overflow-hidden text-[13px] font-medium tabular-nums text-neutral-400 dark:text-muted-foreground opacity-0 transition-all duration-200 ease-out group-hover:w-10 group-hover:opacity-100">
                {percentOfTotal}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Info icon with a tooltip, for rows whose meaning isn't obvious from the name. */
export function RowHint({ label, text }: { label: string; text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`About ${label}`}
            className="shrink-0 rounded-md text-neutral-400 hover:text-neutral-600 dark:text-muted-foreground dark:hover:text-neutral-300"
          >
            <IconInfoCircle size={14} stroke={1.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-[12px]">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type BarListTitleProps = {
  title: string;
  description: string;
  unit?: string;
  children: React.ReactNode;
};

function BarListTitle({ title, description, unit = "Clicks", children }: BarListTitleProps) {
  return (
    <Card className="flex h-full flex-col rounded-xl border-neutral-200 dark:border-border p-5 shadow-none md:col-span-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="space-y-0.5">
          <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            {title}
          </h2>
          <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">{description}</p>
        </div>
        <span className="pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-300 dark:text-muted-foreground">
          {unit}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

type BarListTabViewSwitcherProps<View extends string> = {
  currentView: View;
  views: View[];
  onChangeView: (view: View) => void;
};

function BarListTabViewSwitcher<View extends string>({
  currentView,
  views,
  onChangeView,
}: BarListTabViewSwitcherProps<View>) {
  return (
    <div className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-neutral-100 dark:border-border/50 pb-2">
      {views.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onChangeView(name)}
          className={cn(
            "relative shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
            currentView === name
              ? "bg-neutral-100 dark:bg-muted text-neutral-900 dark:text-foreground"
              : "text-neutral-400 dark:text-muted-foreground hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-600 dark:hover:text-neutral-300",
          )}
        >
          {name.charAt(0).toUpperCase() + name.slice(1)}
        </button>
      ))}
    </div>
  );
}

BarList.BarListTabViewSwitcher = BarListTabViewSwitcher;
BarList.BarListTitle = BarListTitle;
export default BarList;

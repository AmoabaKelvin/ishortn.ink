import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BarListProps = {
  records: {
    name: string;
    clicks: number;
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

  return (
    <div className="flex flex-col gap-1.5">
      {sortedRecords.map((record) => {
        const percentage = maxClicks > 0 ? (record.clicks / maxClicks) * 100 : 0;
        const percentOfTotal = totalClicks > 0 ? ((record.clicks / totalClicks) * 100).toFixed(0) : "0";
        return (
          <div
            key={record.name}
            className="group relative flex items-center justify-between rounded-lg px-3 py-2.5 cursor-default"
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
            <span className="relative z-10 truncate pr-4 text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
              {record.name}
            </span>

            {/* Stats */}
            <div className="relative z-10 flex items-center gap-2">
              <span className="text-[13px] font-semibold tabular-nums text-neutral-600 dark:text-neutral-400">
                {record.clicks.toLocaleString()}
              </span>
              <span className="w-0 overflow-hidden text-[13px] font-medium tabular-nums text-neutral-400 dark:text-neutral-500 opacity-0 transition-all duration-200 ease-out group-hover:w-10 group-hover:opacity-100">
                {percentOfTotal}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type BarListTitleProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function BarListTitle({ title, description, children }: BarListTitleProps) {
  return (
    <Card className="flex h-full flex-col rounded-xl border-neutral-200 dark:border-border p-5 shadow-none md:col-span-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div className="space-y-0.5">
          <h2 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            {title}
          </h2>
          <p className="text-[12px] text-neutral-400 dark:text-neutral-500">{description}</p>
        </div>
        <span className="pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-300 dark:text-neutral-500">
          Clicks
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

type BarListTabViewSwitcherProps = {
  currentView: string;
  views: string[];
  onChangeView: (view: string) => void;
};

function BarListTabViewSwitcher({
  currentView,
  views,
  onChangeView,
}: BarListTabViewSwitcherProps) {
  return (
    <div className="mb-4 flex items-center gap-1 border-b border-neutral-100 dark:border-border/50 pb-2">
      {views.map((name) => (
        <button
          key={name}
          onClick={() => onChangeView(name.toLowerCase())}
          className={cn(
            "relative rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
            currentView === name.toLowerCase()
              ? "bg-neutral-100 dark:bg-muted text-neutral-900 dark:text-foreground"
              : "text-neutral-400 dark:text-neutral-500 hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-600 dark:hover:text-neutral-300"
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

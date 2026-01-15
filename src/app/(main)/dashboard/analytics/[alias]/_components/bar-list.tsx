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
  blue: { bg: "bg-blue-50/70", accent: "bg-blue-400" },
  green: { bg: "bg-emerald-50/70", accent: "bg-emerald-400" },
  red: { bg: "bg-rose-50/70", accent: "bg-rose-400" },
  orange: { bg: "bg-amber-50/70", accent: "bg-amber-400" },
  purple: { bg: "bg-violet-50/70", accent: "bg-violet-400" },
};

export function BarList({ records, totalClicks, color = "blue" }: BarListProps) {
  const sortedRecords = [...records].sort((a, b) => b.clicks - a.clicks);
  const maxClicks = sortedRecords[0]?.clicks ?? 1;

  return (
    <div className="flex flex-col gap-1.5">
      {sortedRecords.map((record, index) => {
        const percentage = maxClicks > 0 ? (record.clicks / maxClicks) * 100 : 0;
        const percentOfTotal = totalClicks > 0 ? ((record.clicks / totalClicks) * 100).toFixed(0) : "0";
        return (
          <div
            key={record.name}
            className="group relative flex items-center justify-between rounded-lg px-3 py-2.5 cursor-default"
            style={{
              animationDelay: `${index * 50}ms`,
            }}
          >
            {/* Background bar with smooth width */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-lg transition-all duration-300 ease-out",
                colorMap[color].bg
              )}
              style={{ width: `${percentage}%` }}
            />

            {/* Left accent border - scales in on hover */}
            <div
              className={cn(
                "absolute left-0 top-1 bottom-1 w-[3px] rounded-full transition-all duration-200 ease-out",
                "scale-y-0 group-hover:scale-y-100 origin-center",
                colorMap[color].accent
              )}
            />

            {/* Item name */}
            <span className="relative z-10 text-[13px] font-medium text-gray-700 truncate pr-4">
              {record.name}
            </span>

            {/* Stats container - count and percentage */}
            <div className="relative z-10 flex items-center gap-2">
              {/* Click count */}
              <span className="text-[13px] tabular-nums font-semibold text-gray-600">
                {record.clicks.toLocaleString()}
              </span>

              {/* Percentage - slides in from right */}
              <span className="text-[13px] tabular-nums font-medium text-gray-400 transition-all duration-200 ease-out w-0 overflow-hidden group-hover:w-10 opacity-0 group-hover:opacity-100">
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
    <Card className="flex h-full flex-col rounded-xl border-gray-100 p-5 md:col-span-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-gray-800 tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        <span className="text-[10px] font-semibold tracking-widest text-gray-300 uppercase pt-0.5">
          Clicks
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">{children}</div>
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
    <div className="mb-4 flex items-center gap-1 border-b border-gray-100 pb-2">
      {views.map((name) => (
        <button
          key={name}
          onClick={() => onChangeView(name.toLowerCase())}
          className={cn(
            "relative px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150",
            currentView === name.toLowerCase()
              ? "text-gray-800 bg-gray-100/80"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
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

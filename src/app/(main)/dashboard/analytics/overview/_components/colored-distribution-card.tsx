"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ColoredDistributionItem = {
  name: string;
  clicks: number;
};

type ColoredDistributionCardProps = {
  title: string;
  description: string;
  items: ColoredDistributionItem[];
  totalClicks: number;
  maxHeight?: string;
  children?: React.ReactNode;
};

export function ColoredDistributionCard({
  title,
  description,
  items,
  totalClicks,
  maxHeight = "h-[400px]",
  children,
}: ColoredDistributionCardProps) {
  // Sort items by clicks descending
  const sortedItems = [...items].sort((a, b) => b.clicks - a.clicks);

  return (
    <Card className="flex flex-col h-full">
      <div className="p-6 pb-4">
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      {children && <div className="px-6">{children}</div>}

      <div
        className={cn(
          "flex flex-col gap-2 overflow-y-auto px-6 pb-6",
          maxHeight
        )}
      >
        {sortedItems.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            No data available
          </div>
        ) : (
          sortedItems.map((item, index) => {
            const percentage = ((item.clicks / totalClicks) * 100).toFixed(1);

            return (
              <div
                key={`${item.name}-${index}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 transition-all hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-700">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 truncate">
                      {item.name}
                    </h3>
                    <p className="text-xs text-gray-600">
                      {item.clicks.toLocaleString()} clicks
                    </p>
                  </div>
                </div>
                <div className="ml-4 text-right shrink-0">
                  <span className="text-lg font-bold text-gray-900">
                    {percentage}%
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

"use client";

import { IconClick } from "@tabler/icons-react";

import { Card } from "@/components/ui/card";
import { api } from "@/trpc/react";

type TopLinksCardProps = {
  from: Date;
  to: Date;
};

export function TopLinksCard({ from, to }: TopLinksCardProps) {
  const { data, isLoading } = api.admin.getTopLinks.useQuery({
    from,
    to,
    limit: 10,
  });

  return (
    <Card className="flex flex-col rounded-xl border-neutral-200 dark:border-border shadow-none">
      <div className="flex items-center justify-between border-b border-neutral-100 dark:border-border/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <IconClick size={15} stroke={1.5} className="text-blue-500 dark:text-blue-400" />
          <p className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Most Clicked Links
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 dark:border-border border-t-neutral-400 dark:border-t-neutral-500" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <p className="text-[13px] text-neutral-400 dark:text-neutral-500">No click data for this period</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 dark:divide-border/50">
          {data.map((l, i) => (
            <div
              key={l.id}
              className="flex items-center gap-3 px-5 py-2.5"
            >
              <span className="w-5 shrink-0 text-center text-[11px] font-semibold tabular-nums text-neutral-300 dark:text-neutral-600">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  <span className="text-neutral-400 dark:text-neutral-500">{l.domain}/</span>
                  {l.alias}
                </p>
                <p className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                  {l.url}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[12px] font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">
                  {l.clicks.toLocaleString()}
                </p>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500">clicks</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

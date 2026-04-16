import { IconArrowDownRight, IconArrowUpRight } from "@tabler/icons-react";

import { Card } from "@/components/ui/card";

type StatCardProps = {
  title: string;
  value: string;
  growth?: number | null;
  hint?: string;
};

export function StatCard({ title, value, growth, hint }: StatCardProps) {
  return (
    <Card className="rounded-xl border-neutral-200 dark:border-border p-5 shadow-none">
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        {title}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-foreground">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {growth !== undefined && growth !== null && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
              growth >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
            }`}
          >
            {growth >= 0 ? (
              <IconArrowUpRight size={12} stroke={2} />
            ) : (
              <IconArrowDownRight size={12} stroke={2} />
            )}
            {Math.abs(growth)}% vs prev period
          </span>
        )}
        {hint && (
          <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
            {hint}
          </span>
        )}
      </div>
    </Card>
  );
}

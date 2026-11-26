import { IconChartAreaLine } from "@tabler/icons-react";

type ChartEmptyStateProps = {
  description: string;
};

export function ChartEmptyState({ description }: ChartEmptyStateProps) {
  return (
    <div className="flex h-72 flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
        <IconChartAreaLine
          size={24}
          stroke={1.5}
          className="text-neutral-400 dark:text-muted-foreground"
        />
      </div>
      <p className="mt-4 text-[14px] font-medium text-neutral-900 dark:text-foreground">
        No clicks yet
      </p>
      <p className="mt-1 max-w-xs text-[13px] text-neutral-400 dark:text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

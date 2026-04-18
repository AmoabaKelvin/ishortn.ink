import { IconArrowDownRight, IconArrowUpRight, IconMinus } from "@tabler/icons-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type QuickInfoCardProps = {
  title: string;
  value: string | number | undefined;
  icon?: React.ReactNode;
  growth?: number | null;
  hint?: string;
};

type GrowthDirection = "up" | "down" | "flat";

const GROWTH_VARIANTS: Record<
  GrowthDirection,
  { icon: React.ReactNode; className: string }
> = {
  up: {
    icon: <IconArrowUpRight size={12} stroke={2} />,
    className: "text-emerald-600 dark:text-emerald-400",
  },
  down: {
    icon: <IconArrowDownRight size={12} stroke={2} />,
    className: "text-red-500 dark:text-red-400",
  },
  flat: {
    icon: <IconMinus size={12} stroke={2} />,
    className: "text-neutral-400 dark:text-neutral-500",
  },
};

export function QuickInfoCard({ title, value, icon, growth, hint }: QuickInfoCardProps) {
  const hasGrowth = growth !== undefined && growth !== null && Number.isFinite(growth);
  // Derive direction from the same rounded value we display, so 0.4% doesn't
  // show "↑ 0%" — the arrow and the label have to agree.
  const roundedGrowth = hasGrowth ? Math.round(growth) : null;
  const direction: GrowthDirection | null =
    roundedGrowth === null
      ? null
      : roundedGrowth === 0
        ? "flat"
        : roundedGrowth > 0
          ? "up"
          : "down";
  const variant = direction ? GROWTH_VARIANTS[direction] : null;

  return (
    <Card className="group rounded-xl border-neutral-200 dark:border-border p-4 shadow-none transition-colors duration-150 hover:border-neutral-300 dark:hover:border-neutral-600">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          {title}
        </p>
        {icon && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center text-neutral-400 dark:text-neutral-500">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="truncate text-xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-foreground">
          {value ?? "—"}
        </span>
        {variant && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium tabular-nums",
              variant.className,
            )}
            title="vs previous period"
          >
            {variant.icon}
            {direction === "flat" ? "0%" : `${Math.abs(roundedGrowth!)}%`}
          </span>
        )}
        {hint && !hasGrowth && (
          <span className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
            {hint}
          </span>
        )}
      </div>
    </Card>
  );
}

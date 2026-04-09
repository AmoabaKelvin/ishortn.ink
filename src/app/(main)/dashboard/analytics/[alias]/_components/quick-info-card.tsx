import { Card } from "@/components/ui/card";

type QuickInfoCardProps = {
  title: string;
  value: string | number | undefined;
  icon?: React.ReactNode;
};

export function QuickInfoCard({ title, value, icon }: QuickInfoCardProps) {
  return (
    <Card className="group relative overflow-hidden rounded-xl border-neutral-200 dark:border-border p-5 shadow-none transition-colors duration-150 hover:border-neutral-300 dark:hover:border-neutral-600">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            {title}
          </p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-foreground">
            {value ?? "—"}
          </p>
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

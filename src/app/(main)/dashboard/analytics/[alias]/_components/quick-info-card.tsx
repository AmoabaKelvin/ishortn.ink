import { Card } from "@/components/ui/card";

type QuickInfoCardProps = {
  title: string;
  value: string | number | undefined;
  icon?: React.ReactNode;
};

export function QuickInfoCard({ title, value, icon }: QuickInfoCardProps) {
  return (
    <Card className="group relative overflow-hidden rounded-xl border-neutral-200 p-5 shadow-none transition-colors duration-150 hover:border-neutral-300">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            {title}
          </p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900">
            {value ?? "—"}
          </p>
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

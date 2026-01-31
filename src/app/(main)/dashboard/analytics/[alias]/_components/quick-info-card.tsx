import { Card } from "@/components/ui/card";

type QuickInfoCardProps = {
  title: string;
  value: string | number | undefined;
  icon?: React.ReactNode;
};

export function QuickInfoCard({ title, value, icon }: QuickInfoCardProps) {
  return (
    <Card className="group relative overflow-hidden rounded-xl border-gray-100 p-5 shadow-sm transition-all duration-200 hover:shadow-md">
      {/* Subtle accent line that appears on hover */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-400 scale-y-0 group-hover:scale-y-100 origin-center transition-transform duration-200 ease-out rounded-full" />

      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {title}
          </p>
          <p className="text-2xl font-semibold text-gray-800 tabular-nums tracking-tight">
            {value ?? "—"}
          </p>
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50/80 text-blue-500 transition-colors duration-200 group-hover:bg-blue-100">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QuickInfoCardProps = {
  title: string;
  value: string | number | undefined;
  icon?: React.ReactNode;
};

export function QuickInfoCard({ title, value, icon }: QuickInfoCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value ?? "—"}</div>
      </CardContent>
    </Card>
  );
}

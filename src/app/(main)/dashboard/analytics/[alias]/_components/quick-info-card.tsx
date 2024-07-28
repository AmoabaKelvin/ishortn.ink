import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QuickInfoCardProps = {
  title: string;
  value: string | number | undefined;
  icon?: React.ReactNode;
};

function QuickInfoCard({ title, value, icon }: QuickInfoCardProps) {
  return (
    // expand card on hover
    <Card className="transition-transform duration-300 hover:scale-105">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default QuickInfoCard;

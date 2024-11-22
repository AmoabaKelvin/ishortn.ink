import { Card } from "@/components/ui/card";

type UserLinksOverViewProps = {
  numberOfLinks: number;
  numberOfClicks: number;
};

const UserLinksOverView = ({
  numberOfLinks,
  numberOfClicks,
}: UserLinksOverViewProps) => {
  return (
    <Card className="p-6">
      <div>
        <h1 className="text-xl font-semibold leading-tight text-gray-800">
          Quick Stats
        </h1>
        <p className="text-sm text-gray-500">
          Get a quick overview of your links
        </p>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2 rounded-md">
          <span className="text-xl font-semibold text-gray-800">
            Total Links
          </span>
          <span className="text-5xl text-gray-500">{numberOfLinks}</span>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-xl font-semibold text-gray-800">
            Total Clicks
          </span>
          <span className="text-5xl text-gray-500">{numberOfClicks}</span>
        </div>
      </div>
    </Card>
  );
};

export { UserLinksOverView };

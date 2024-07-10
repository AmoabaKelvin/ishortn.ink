import { cn } from "@/lib/utils";

type BarListProps = {
  records: {
    name: string;
    clicks: number;
  }[];
  totalClicks: number;
};

export function BarList({ records, totalClicks }: BarListProps) {
  records.sort((a, b) => b.clicks - a.clicks);

  return (
    <>
      {records.map((record) => (
        <div key={record.name} className="flex items-center justify-between">
          <div className="z-50 flex items-center gap-4  bg-gray-100/65 dark:bg-[#0a1013]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-[#0f191d]">
              {record.name[0]}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{record.name}</h2>
              <p className="text-xs text-muted-foreground">{record.clicks} clicks</p>
            </div>
          </div>
          <div className="text-xs font-semibold text-foreground">
            {((record.clicks / totalClicks) * 100).toFixed(2)}%
          </div>
        </div>
      ))}
    </>
  );
}

type BarListTitleProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function BarListTitle({ title, description, children }: BarListTitleProps) {
  return (
    <div className="flex h-max flex-col gap-4 rounded-md bg-gray-100/65 p-6 dark:bg-[#0a1013] md:col-span-5">
      <div>
        <h1 className="text-xl font-semibold leading-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

type BarListTabViewSwitcherProps = {
  currentView: string;
  views: string[];
  onChangeView: (view: string) => void;
};

function BarListTabViewSwitcher({ currentView, views, onChangeView }: BarListTabViewSwitcherProps) {
  return (
    <div className="mb-3 w-max border-b border-gray-200 text-center font-medium text-foreground">
      <ul className="-mb-px flex flex-wrap gap-4">
        {views.map((name) => (
          <li key={name} className="me-2">
            <span
              onClick={() => onChangeView(name.toLowerCase())}
              className={cn(
                "inline-block cursor-pointer rounded-t-lg border-b-2 border-transparent py-2 hover:border-gray-300 hover:text-gray-600",
                currentView === name.toLowerCase() &&
                  "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500",
              )}
            >
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

BarList.BarListTabViewSwitcher = BarListTabViewSwitcher;
BarList.BarListTitle = BarListTitle;
export default BarList;

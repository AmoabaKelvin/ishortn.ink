import { cn } from "@/lib/utils";

// Make it generic

interface StatsSwitcherProps {
  currentView: string;
  views: string[];
  setCurrentView: (view: string) => void;
}

const StatsSwitcher = ({
  currentView,
  setCurrentView,
  views,
}: StatsSwitcherProps) => {
  return (
    <div className="mb-3 text-sm font-medium text-center text-gray-500 border-b border-gray-200 w-max">
      <ul className="flex flex-wrap gap-4 -mb-px">
        {views.map((name) => (
          <li key={name} className="me-2">
            <span
              onClick={() => setCurrentView(name.toLowerCase())}
              className={cn(
                "inline-block py-2 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 cursor-pointer",
                currentView === name.toLowerCase() &&
                  "text-blue-600 border-blue-600 dark:border-blue-500"
              )}
            >
              {name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StatsSwitcher;

interface StatBarProps {
  name: string;
  clicks: number;
  totalClicks: number;
}

const StatBar = ({ name, clicks, totalClicks }: StatBarProps) => {
  return (
    <div
      key={name}
      className="relative flex items-center justify-between gap-2 px-1 rounded-md"
    >
      <span className="z-50 text-base font-semibold text-gray-600">{name}</span>
      <div className="flex items-center gap-2">
        <span className="z-50 text-base font-bold text-black">{clicks}</span>
        <div className="w-px h-4 bg-gray-300" />
        <span className="text-sm text-gray-500">
          {((clicks / totalClicks) * 100).toFixed(0)}%
        </span>
      </div>

      {/* An absolutely positioned box  whose width will be the percentage of clicks of the country */}
      <div
        className="absolute top-0 left-0 h-full bg-blue-100 rounded-sm"
        style={{ width: `${(clicks / totalClicks) * 100}%` }}
      />
    </div>
  );
};

export default StatBar;

interface StatsSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

const StatsSection = ({ title, description, children }: StatsSectionProps) => {
  return (
    <div className="flex flex-col gap-4 p-6 rounded-md bg-gray-50 h-max md:col-span-5">
      <div>
        <h1 className="text-xl font-semibold leading-tight text-gray-800">
          {title}
        </h1>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
};

export default StatsSection;

import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSignupsLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="mt-1 h-4 w-64" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[106px] rounded-xl" />
        ))}
      </div>

      <Skeleton className="mt-4 h-[360px] rounded-xl" />
      <Skeleton className="mt-4 h-[420px] rounded-xl" />
    </div>
  );
}

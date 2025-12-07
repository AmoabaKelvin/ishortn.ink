import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Links Filter Skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2 mb-6">
        <Skeleton className="h-10 w-full sm:flex-1" />
        <Skeleton className="h-10 w-full sm:w-[140px]" />
        <Skeleton className="h-10 w-full sm:w-[140px]" />
        <Skeleton className="h-10 w-full sm:w-[180px]" />
      </div>

      {/* Links List Skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col rounded-md border bg-card text-card-foreground shadow-sm px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                {/* Link Name & Copy */}
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
                {/* Date & URL */}
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-4 rounded-full" /> {/* Dot */}
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              {/* Right Side: Clicks & Actions */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

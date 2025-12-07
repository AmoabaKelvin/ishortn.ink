import { Skeleton } from "@/components/ui/skeleton";

export default function DomainsLoading() {
  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-6 w-96" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Domain Cards Skeleton */}
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 bg-card p-5"
          >
            {/* Header Row */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 mt-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

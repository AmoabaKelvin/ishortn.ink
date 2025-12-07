import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </div>
            <div className="pt-2">
              <Skeleton className="h-8 w-16 mb-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Time Series Chart */}
      <div className="rounded-xl border bg-card text-card-foreground shadow p-6">
        <div className="mb-4">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-[350px] w-full" />
      </div>

      {/* Distribution Cards Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:auto-rows-fr">
        {/* Row 1 & 2 */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card text-card-foreground shadow p-6">
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 mb-4">
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Row 3: Device Stats */}
        <div className="lg:col-span-2 rounded-xl border bg-card text-card-foreground shadow p-6">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2 mb-4">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-4 w-24 mx-auto" />
                <Skeleton className="h-32 w-32 rounded-full mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

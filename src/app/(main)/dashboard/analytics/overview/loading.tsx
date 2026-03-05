import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-[240px]" />
          <Skeleton className="h-9 w-[180px]" />
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 p-5 shadow-none">
            <div className="flex items-center justify-between pb-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <div className="pt-1">
              <Skeleton className="h-7 w-14" />
            </div>
          </div>
        ))}
      </div>

      {/* Time Series Chart */}
      <div className="rounded-xl border border-neutral-200 p-5 shadow-none">
        <div className="mb-4">
          <Skeleton className="mb-1.5 h-5 w-36" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>

      {/* Distribution Cards Grid */}
      <div className="grid grid-cols-1 gap-4 lg:auto-rows-fr lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 p-5 shadow-none">
            <div className="mb-4">
              <Skeleton className="mb-1.5 h-4 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between rounded-lg border border-neutral-100 p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Device Stats */}
        <div className="rounded-xl border border-neutral-200 p-5 shadow-none lg:col-span-2">
          <div className="mb-4">
            <Skeleton className="mb-1.5 h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="flex gap-4 border-b border-neutral-100 pb-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between rounded-lg border border-neutral-100 p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

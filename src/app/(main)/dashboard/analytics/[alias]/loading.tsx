import { Skeleton } from "@/components/ui/skeleton";

export default function LinkAnalyticsLoading() {
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex flex-col items-center gap-1 md:items-start">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-[180px]" />
      </div>

      {/* Quick Info Cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:grid-cols-2 md:gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 p-4 dark:border-border">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-14" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="mt-8 rounded-xl border border-neutral-200 p-5 dark:border-border md:mt-10">
        <div className="mb-4">
          <Skeleton className="mb-1.5 h-5 w-36" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>

      {/* Breakdown cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 p-5 dark:border-border">
            <Skeleton className="mb-1.5 h-4 w-28" />
            <Skeleton className="h-3 w-44" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-8 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

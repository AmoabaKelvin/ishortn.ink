import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Skeleton className="h-9 w-full sm:flex-1" />
        <Skeleton className="h-9 w-full sm:w-[130px]" />
        <Skeleton className="h-9 w-full sm:w-[130px]" />
        <Skeleton className="h-9 w-full sm:w-[170px]" />
      </div>

      {/* Link list */}
      <div className="mt-4 divide-y divide-neutral-300/60 dark:divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="px-1 py-4"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-6 w-6 rounded-md" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Skeleton className="h-3.5 w-10" />
                  <Skeleton className="h-3.5 w-52" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function FoldersLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="mt-1 h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* List skeleton - flat rows */}
      <div className="divide-y divide-neutral-300/60 dark:divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-1 py-4">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-40" />
              <div className="mt-1.5 flex items-center gap-2">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-7 w-12 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

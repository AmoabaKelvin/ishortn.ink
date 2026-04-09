import { Skeleton } from "@/components/ui/skeleton";

export default function QRCodesLoading() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-1.5 h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* List */}
      <div className="divide-y divide-neutral-300/60 dark:divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-1 py-4">
            {/* Thumbnail */}
            <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />

            {/* Content */}
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-36" />
              <div className="mt-1.5 flex items-center gap-1.5">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

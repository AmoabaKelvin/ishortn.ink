import { Skeleton } from "@/components/ui/skeleton";

export default function FoldersLoading() {
  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-6 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Folder Cards Skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-md border bg-card text-card-foreground shadow-sm px-6 py-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                {/* Folder Name */}
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-48" />
                </div>
                {/* Date & Link Count */}
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-4 rounded-full" /> {/* Dot */}
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
              {/* Right Side: Action Buttons */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function FoldersLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="mt-8 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-md border bg-card text-card-foreground shadow-sm px-6 py-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-48" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
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

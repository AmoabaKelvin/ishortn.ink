import { Skeleton } from "@/components/ui/skeleton";

export default function QRCodesLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-24 w-24 rounded-md" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-48" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
                <Skeleton className="h-4 w-64" />
                <div className="flex gap-2 mt-4">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

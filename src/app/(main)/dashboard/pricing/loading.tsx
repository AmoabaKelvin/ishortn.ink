import { Skeleton } from "@/components/ui/skeleton";

export default function PricingLoading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <Skeleton className="h-9 w-64 mx-auto" />
        <Skeleton className="h-5 w-96 mx-auto" />
      </div>

      {/* Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border p-6 space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-12 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="space-y-3 pt-4">
              {[1, 2, 3, 4, 5].map((j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

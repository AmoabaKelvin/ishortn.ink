import { Skeleton } from "@/components/ui/skeleton";

export default function TeamMembersLoading() {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-1.5 h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      <div className="divide-y divide-neutral-300/60">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-1 py-4">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-1.5 w-1.5 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="mt-1.5 h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

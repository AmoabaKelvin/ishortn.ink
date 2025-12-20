import { Skeleton } from "@/components/ui/skeleton";

export default function TeamMembersLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-16 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

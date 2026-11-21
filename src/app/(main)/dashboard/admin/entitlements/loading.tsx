import { Skeleton } from "@/components/ui/skeleton";

import { EntitlementsSkeleton } from "./_components/entitlements-skeleton";

export default function AdminEntitlementsLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-1 h-4 w-80 max-w-full" />
      </div>
      <EntitlementsSkeleton />
    </div>
  );
}

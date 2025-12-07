import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-10">
      {/* Page Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-6 w-96" />
      </div>

      <Separator />

      {/* General Settings Section Skeleton */}
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="rounded-lg border border-gray-200 bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <Separator />

      {/* Billing Section Skeleton */}
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid gap-6">
          <div className="rounded-lg border border-gray-200 bg-card p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-card p-6 space-y-3">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="rounded-lg border border-gray-200 bg-card p-6 space-y-3">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* API Keys Section Skeleton */}
      <div className="space-y-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="max-w-3xl">
          <div className="rounded-lg border border-gray-200 bg-card p-6 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

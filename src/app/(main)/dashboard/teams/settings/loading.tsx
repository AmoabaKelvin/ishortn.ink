import { Skeleton } from "@/components/ui/skeleton";

export default function TeamSettingsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {/* General Settings */}
        <section>
          <Skeleton className="h-4 w-16 mb-4" />
          <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-16" />
          </div>
        </section>

        {/* Team URL */}
        <section>
          <Skeleton className="h-4 w-20 mb-4" />
          <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-3 w-72" />
            <Skeleton className="h-9 w-24" />
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <Skeleton className="h-4 w-24 mb-4" />
          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

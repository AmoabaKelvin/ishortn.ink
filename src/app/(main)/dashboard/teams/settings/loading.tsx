import { Skeleton } from "@/components/ui/skeleton";

export default function TeamSettingsLoading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-1.5 h-4 w-48" />
      </div>

      <div className="space-y-8">
        {/* General */}
        <section>
          <Skeleton className="mb-3 h-4 w-16" />
          <div className="space-y-4 rounded-xl border border-neutral-200 dark:border-border p-5">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-9 w-16 rounded-lg" />
            </div>
          </div>
        </section>

        {/* Team URL */}
        <section>
          <Skeleton className="mb-3 h-4 w-20" />
          <div className="space-y-4 rounded-xl border border-neutral-200 dark:border-border p-5">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <Skeleton className="h-3 w-64" />
            <div className="flex justify-end">
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="rounded-xl border border-neutral-200 dark:border-border p-5">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-1 h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

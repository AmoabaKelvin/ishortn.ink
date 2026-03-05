import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div>
      <div className="mb-8">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="mt-1 h-4 w-48" />
      </div>

      <div className="flex gap-10">
        <nav className="hidden lg:block w-44 flex-shrink-0">
          <div className="sticky top-24 space-y-0.5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0 space-y-12 pb-20">
          {[...Array(5)].map((_, i) => (
            <section key={i} className="space-y-4">
              <div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-1 h-3 w-40" />
              </div>
              <div className="rounded-xl border border-neutral-200 p-5">
                <div className="space-y-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

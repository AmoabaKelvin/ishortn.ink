import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Header Skeleton */}
      <div className="rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 px-8 py-12 mb-10">
        <Skeleton className="h-4 w-16 bg-neutral-700 mb-3" />
        <Skeleton className="h-12 w-48 bg-neutral-700 mb-3" />
        <Skeleton className="h-5 w-96 bg-neutral-700" />
      </div>

      <div className="flex gap-10">
        {/* Sidebar Navigation Skeleton */}
        <nav className="hidden lg:block w-48 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
            <div className="mt-8">
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
        </nav>

        {/* Main Content Skeleton */}
        <div className="flex-1 min-w-0 space-y-16 pb-20">
          {/* Profile Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200/80 bg-white overflow-hidden">
              <div className="bg-neutral-50 px-6 py-8 border-b border-neutral-100">
                <div className="flex items-center gap-5">
                  <Skeleton className="w-20 h-20 rounded-2xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-28 rounded-xl" />
                </div>
              </div>
            </div>
          </section>

          {/* General Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200/80 bg-white overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-10 w-28 rounded-xl" />
                </div>
              </div>
            </div>
          </section>

          {/* Billing Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200/80 bg-white overflow-hidden">
              <div className="px-6 py-6 border-b border-neutral-100">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </div>
                <div className="flex gap-3 pt-4 border-t border-neutral-100">
                  <Skeleton className="h-10 w-40 rounded-xl" />
                  <Skeleton className="h-10 w-28 rounded-xl" />
                </div>
              </div>
            </div>
          </section>

          {/* API Keys Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200/80 bg-white p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-48 rounded-lg" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-28 rounded-xl" />
              </div>
            </div>
          </section>

          {/* Account Transfer Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-4 w-52" />
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200/80 bg-white overflow-hidden">
              <div className="px-6 py-5 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <div className="flex gap-3">
                    <Skeleton className="h-11 flex-1 rounded-xl" />
                    <Skeleton className="h-11 w-28 rounded-xl" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Skeleton className="h-24 rounded-xl" />
                  <Skeleton className="h-24 rounded-xl" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

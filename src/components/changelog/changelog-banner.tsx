"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Link } from "next-view-transitions";
import { useState } from "react";

import { api } from "@/trpc/react";

export function ChangelogBanner() {
  const [dismissedSlug, setDismissedSlug] = useState<string | null>(null);

  const { data: newEntries } = api.changelog.getNewEntries.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const markAsViewed = api.changelog.markAsViewed.useMutation();

  const latestEntry = newEntries?.[0];
  const isDismissed = latestEntry === undefined || latestEntry.slug === dismissedSlug;

  const handleDismiss = () => {
    if (!latestEntry) return;
    setDismissedSlug(latestEntry.slug);
    markAsViewed.mutate({ slug: latestEntry.slug });
  };

  return (
    <AnimatePresence>
      {!isDismissed && latestEntry && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="border-b border-neutral-200 bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
              <p className="flex items-center gap-2 text-[13px] text-neutral-500">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                  New
                </span>
                <span className="font-medium text-neutral-900">{latestEntry.title}</span>
                <span className="mx-1 hidden text-neutral-300 sm:inline">—</span>
                <span className="hidden sm:inline">{latestEntry.shortDesc}</span>
              </p>

              <div className="flex items-center gap-3">
                <Link
                  href="/changelog"
                  className="text-[13px] font-medium text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-600"
                >
                  View changelog
                </Link>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "next-view-transitions";
import { api } from "@/trpc/react";

export function ChangelogBanner() {
  const [isDismissed, setIsDismissed] = useState(true);
  const [latestEntry, setLatestEntry] = useState<{
    shortDesc: string;
    date: string;
    title: string;
  } | null>(null);

  const { data: newEntries } = api.changelog.getNewEntries.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const markAsViewed = api.changelog.markAsViewed.useMutation();

  useEffect(() => {
    if (newEntries && newEntries.length > 0) {
      const latest = newEntries[0];
      if (latest) {
        setLatestEntry({
          shortDesc: latest.shortDesc,
          date: latest.date,
          title: latest.title,
        });
        setIsDismissed(false);
      }
    }
  }, [newEntries]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (latestEntry?.date) {
      markAsViewed.mutate({ date: latestEntry.date });
    }
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
          <div className="bg-blue-600">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
              <p className="text-sm text-blue-100">
                <span className="font-medium text-white">{latestEntry.title}</span>
                <span className="mx-2 hidden text-blue-300 sm:inline">—</span>
                <span className="hidden sm:inline">{latestEntry.shortDesc}</span>
              </p>

              <div className="flex items-center gap-3">
                <Link
                  href="/changelog"
                  className="text-sm font-medium text-white underline underline-offset-4 hover:text-blue-100"
                >
                  View changelog
                </Link>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-blue-200 hover:text-white"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

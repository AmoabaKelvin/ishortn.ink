"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "next-view-transitions";
import { api } from "@/trpc/react";

const STORAGE_KEY = "changelog-toast-dismissed";

export function ChangelogToast() {
  const [isVisible, setIsVisible] = useState(false);
  const [latestEntry, setLatestEntry] = useState<{
    shortDesc: string;
    date: string;
    title: string;
    version: string;
  } | null>(null);

  const { data: newEntries } = api.changelog.getNewEntries.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const markAsViewed = api.changelog.markAsViewed.useMutation();

  useEffect(() => {
    if (newEntries && newEntries.length > 0) {
      const latest = newEntries[0];
      if (!latest) return;

      const dismissedVersion = localStorage.getItem(STORAGE_KEY);

      if (dismissedVersion !== latest.version) {
        setLatestEntry({
          shortDesc: latest.shortDesc,
          date: latest.date,
          title: latest.title,
          version: latest.version,
        });
        // Delay showing the toast for better UX
        const timer = setTimeout(() => setIsVisible(true), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [newEntries]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (latestEntry) {
      localStorage.setItem(STORAGE_KEY, latestEntry.version);
      markAsViewed.mutate({ date: latestEntry.date });
    }
  };

  const handleViewChangelog = () => {
    if (latestEntry) {
      localStorage.setItem(STORAGE_KEY, latestEntry.version);
      markAsViewed.mutate({ date: latestEntry.date });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && latestEntry && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-6 right-6 z-50 w-[320px] max-w-[calc(100vw-3rem)]"
        >
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-lg">
            {/* Header */}
            <div className="mb-3 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-500">
                  v{latestEntry.version}
                </span>
                <span className="h-1 w-1 rounded-full bg-neutral-300" />
                <span className="text-xs text-neutral-400">New update</span>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="-mr-1 -mt-1 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <h3 className="mb-1 text-sm font-medium text-neutral-900">
              {latestEntry.title}
            </h3>
            <p className="mb-4 text-sm text-neutral-500">
              {latestEntry.shortDesc}
            </p>

            {/* Action */}
            <Link
              href="/changelog"
              onClick={handleViewChangelog}
              className="text-sm font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
            >
              View changelog
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

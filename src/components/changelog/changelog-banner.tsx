"use client";

import { IconX } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "next-view-transitions";

import { withProductUtm } from "@/lib/attribution/referral";
import { api } from "@/trpc/react";

// The only surface announcing changelog entries. Dismissal is stored server-side
// (lastViewedChangelogSlug), so it hides on every device and tab.
export function ChangelogBanner() {
  const utils = api.useUtils();

  const { data: newEntries } = api.changelog.getNewEntries.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const markAsViewed = api.changelog.markAsViewed.useMutation({
    onMutate: () => {
      // Entries are newest first, so viewing the latest clears them all.
      utils.changelog.getNewEntries.setData(undefined, []);
    },
    onSettled: () => {
      void utils.changelog.getNewEntries.invalidate();
    },
  });

  const latestEntry = newEntries?.[0];

  const handleViewed = () => {
    if (!latestEntry) return;
    markAsViewed.mutate({ slug: latestEntry.slug });
  };

  return (
    <AnimatePresence initial={false}>
      {latestEntry && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="border-b border-neutral-200 bg-white dark:border-border dark:bg-card">
            <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
              <p className="flex min-w-0 items-center gap-2 text-[13px] text-neutral-500 dark:text-neutral-400">
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-muted dark:text-neutral-300">
                  New
                </span>
                <span className="truncate font-medium text-neutral-900 dark:text-foreground">
                  {latestEntry.title}
                </span>
                <span className="hidden shrink-0 text-neutral-300 md:inline dark:text-neutral-600">
                  —
                </span>
                <span className="hidden truncate md:inline">{latestEntry.shortDesc}</span>
              </p>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <Link
                  href={withProductUtm("/changelog", "app", "changelog_banner")}
                  onClick={handleViewed}
                  className="text-[13px] font-medium whitespace-nowrap text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-600 dark:text-foreground dark:hover:text-neutral-300"
                >
                  <span className="hidden sm:inline">View changelog</span>
                  <span className="sm:hidden">View</span>
                </Link>

                <button
                  type="button"
                  onClick={handleViewed}
                  className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-neutral-300"
                  aria-label="Dismiss changelog announcement"
                >
                  <IconX size={14} stroke={1.5} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

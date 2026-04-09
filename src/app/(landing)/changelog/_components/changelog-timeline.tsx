"use client";

import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";

import type { ChangelogEntry, ChangelogCategory } from "@/lib/changelog";

const categories: Record<ChangelogCategory, { label: string; color: string }> = {
  feature: { label: "Feature", color: "text-emerald-600 dark:text-emerald-400" },
  improvement: { label: "Improvement", color: "text-blue-600 dark:text-blue-400" },
  fix: { label: "Fix", color: "text-amber-600 dark:text-amber-400" },
  breaking: { label: "Breaking change", color: "text-red-600 dark:text-red-400" },
};

const defaultCategory = { label: "Update", color: "text-neutral-500 dark:text-neutral-400" };

interface ChangelogTimelineProps {
  entries: ChangelogEntry[];
}

export function ChangelogTimeline({ entries }: ChangelogTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No changelog entries yet.</p>
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry, index) => (
        <Entry key={entry.slug} entry={entry} index={index} />
      ))}
    </div>
  );
}

function Entry({ entry, index }: { entry: ChangelogEntry; index: number }) {
  const date = parseISO(entry.date);
  const category = categories[entry.category] ?? defaultCategory;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.15) }}
      className="border-b border-neutral-100 dark:border-border/50 py-14 first:pt-0 last:border-0"
    >
      {/* Metadata line */}
      <p className="text-[13px] tabular-nums text-neutral-400 dark:text-neutral-500">
        {format(date, "MMM d, yyyy")}
        <span className="mx-2 text-neutral-200 dark:text-neutral-600">&middot;</span>
        v{entry.version}
        <span className="mx-2 text-neutral-200 dark:text-neutral-600">&middot;</span>
        <span className={category.color}>{category.label}</span>
      </p>

      {/* Title */}
      <h2 className="mt-3 font-display text-2xl tracking-tight text-neutral-900 dark:text-foreground sm:text-3xl">
        {entry.title}
      </h2>

      {/* Description */}
      <p className="mt-2 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        {entry.shortDesc}
      </p>

      {/* Content */}
      <div className="mt-6 rounded-xl border border-neutral-100 dark:border-border/50">
        <div
          className="changelog-prose prose prose-neutral max-w-none p-6 prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-6 prose-h2:text-lg prose-h3:mt-4 prose-h3:text-base prose-p:text-neutral-600 prose-a:text-neutral-900 prose-a:underline-offset-2 prose-strong:font-semibold prose-li:text-neutral-600 prose-table:text-sm prose-th:bg-neutral-50 prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown content is parsed and sanitized
          dangerouslySetInnerHTML={{ __html: entry.htmlContent }}
        />
      </div>
    </motion.article>
  );
}

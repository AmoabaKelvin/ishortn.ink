"use client";

import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  IconAlertTriangle,
  IconBug,
  IconSparkles,
  IconWand,
  type Icon,
} from "@tabler/icons-react";

import type { ChangelogCategory, ChangelogEntry } from "@/lib/changelog";

type CategoryMeta = {
  label: string;
  Icon: Icon;
};

const categories: Record<ChangelogCategory, CategoryMeta> = {
  feature: { label: "Feature", Icon: IconSparkles },
  improvement: { label: "Improvement", Icon: IconWand },
  fix: { label: "Fix", Icon: IconBug },
  breaking: { label: "Breaking change", Icon: IconAlertTriangle },
};

const defaultCategory: CategoryMeta = { label: "Update", Icon: IconSparkles };

interface ChangelogTimelineProps {
  entries: ChangelogEntry[];
}

export function ChangelogTimeline({ entries }: ChangelogTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-16 text-center">
        <p className="text-sm text-zinc-500">No changelog entries yet.</p>
      </div>
    );
  }

  return (
    <ol className="relative mx-auto max-w-4xl">
      {entries.map((entry, index) => (
        <Entry
          key={entry.slug}
          entry={entry}
          index={index}
          isFirst={index === 0}
          isLast={index === entries.length - 1}
        />
      ))}
    </ol>
  );
}

function Entry({
  entry,
  index,
  isFirst,
  isLast,
}: {
  entry: ChangelogEntry;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const date = parseISO(entry.date);
  const category = categories[entry.category] ?? defaultCategory;
  const CategoryIcon = category.Icon;

  const railClasses = [
    "pointer-events-none absolute left-4 w-px bg-zinc-800 md:left-32",
    isFirst && !isLast && "top-4 bottom-0 md:top-12",
    isLast && !isFirst && "top-0 h-4 md:h-12",
    !isFirst && !isLast && "top-0 bottom-0",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.15) }}
      className="relative grid gap-6 pb-16 last:pb-0 md:grid-cols-[8rem_1fr] md:gap-10"
    >
      {/* Vertical rail segment — starts at first dot, ends at last dot */}
      {!(isFirst && isLast) && <div aria-hidden className={railClasses} />}

      {/* Date rail */}
      <div className="flex items-start gap-4 md:flex-col md:items-end md:gap-2 md:pt-8">
        <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 md:translate-x-4">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        </div>
        <time
          dateTime={entry.date}
          className="text-sm text-zinc-500 md:mt-1 tabular-nums"
        >
          {format(date, "MMM d, yyyy")}
        </time>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-colors hover:bg-zinc-900/60">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
            <CategoryIcon size={12} className="shrink-0" />
            {category.label}
          </span>
          {entry.version && (
            <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300">
              v{entry.version}
            </span>
          )}
        </div>

        <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight text-zinc-50 md:text-3xl">
          {entry.title}
        </h2>

        {entry.shortDesc && (
          <p className="mt-3 text-base leading-relaxed text-zinc-400">
            {entry.shortDesc}
          </p>
        )}

        <div
          className="changelog-prose prose prose-invert mt-6 max-w-none prose-headings:font-heading prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-zinc-50 prose-h2:mt-6 prose-h2:text-lg prose-h3:mt-4 prose-h3:text-base prose-p:text-zinc-400 prose-a:text-blue-400 prose-a:no-underline hover:prose-a:text-blue-300 prose-strong:text-zinc-100 prose-strong:font-semibold prose-li:text-zinc-400 prose-li:marker:text-zinc-600 prose-code:text-zinc-200 prose-hr:border-zinc-800 prose-table:text-sm prose-th:bg-zinc-900 prose-th:text-zinc-300 prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2 prose-td:text-zinc-400 prose-blockquote:border-zinc-800 prose-blockquote:text-zinc-400"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown content is parsed and sanitized
          dangerouslySetInnerHTML={{ __html: entry.htmlContent }}
        />
      </div>
    </motion.li>
  );
}

"use client";

import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  Sparkles,
  Zap,
  Bug,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import type { ChangelogEntry, ChangelogCategory } from "@/lib/changelog";

const categoryConfig: Record<
  ChangelogCategory,
  { icon: typeof Sparkles; label: string; color: string; bgColor: string }
> = {
  feature: {
    icon: Sparkles,
    label: "New Feature",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 border-emerald-200/60",
  },
  improvement: {
    icon: Zap,
    label: "Improvement",
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200/60",
  },
  fix: {
    icon: Bug,
    label: "Bug Fix",
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-200/60",
  },
  breaking: {
    icon: AlertTriangle,
    label: "Breaking Change",
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200/60",
  },
};

interface ChangelogTimelineProps {
  entries: ChangelogEntry[];
}

export function ChangelogTimeline({ entries }: ChangelogTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-neutral-500">No changelog entries yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line - positioned with more space from the date column */}
      <div className="absolute left-0 top-0 hidden h-full w-px bg-gradient-to-b from-neutral-200 via-neutral-300 to-neutral-200 md:left-[9rem] md:block" />

      <div className="space-y-0">
        {entries.map((entry, index) => (
          <TimelineEntry key={entry.slug} entry={entry} index={index} />
        ))}
      </div>
    </div>
  );
}

interface TimelineEntryProps {
  entry: ChangelogEntry;
  index: number;
}

const defaultCategory = {
  icon: Sparkles,
  label: "Update",
  color: "text-neutral-600",
  bgColor: "bg-neutral-50 border-neutral-200/60",
};

function TimelineEntry({ entry, index }: TimelineEntryProps) {
  const category = categoryConfig[entry.category] ?? defaultCategory;
  const CategoryIcon = category.icon;
  const date = parseISO(entry.date);

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative pb-12 last:pb-0"
    >
      <div className="md:grid md:grid-cols-[8rem_1fr] md:gap-10">
        {/* Date column */}
        <div className="mb-4 flex items-start gap-4 md:mb-0 md:flex-col md:items-end md:gap-2 md:pr-4">
          <time
            dateTime={entry.date}
            className="text-sm font-medium tabular-nums text-neutral-400"
          >
            {format(date, "MMM d, yyyy")}
          </time>
          <span className="font-mono text-xs text-neutral-300">
            v{entry.version}
          </span>
        </div>

        {/* Timeline dot */}
        <div className="absolute left-0 hidden h-3 w-3 -translate-x-[5px] translate-y-1.5 rounded-full border-2 border-white bg-neutral-300 shadow-sm transition-colors group-hover:bg-neutral-900 md:left-[9rem] md:block" />

        {/* Content */}
        <div className="relative">
          {/* Category badge */}
          <div
            className={`mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${category.bgColor} ${category.color}`}
          >
            <CategoryIcon className="h-3 w-3" />
            {category.label}
          </div>

          {/* Title */}
          <h2 className="mb-3 text-2xl font-semibold tracking-tight text-neutral-900">
            {entry.title}
          </h2>

          {/* Short description */}
          <p className="mb-6 text-neutral-600">{entry.shortDesc}</p>

          {/* Content card */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-white/80 backdrop-blur-sm transition-all duration-300 hover:border-neutral-300/80 hover:shadow-lg hover:shadow-neutral-900/5">
            <div
              className="changelog-prose prose prose-neutral max-w-none p-6 prose-headings:font-semibold prose-headings:tracking-tight prose-h2:mt-6 prose-h2:text-lg prose-h3:mt-4 prose-h3:text-base prose-p:text-neutral-600 prose-a:text-neutral-900 prose-a:underline-offset-2 prose-strong:font-semibold prose-li:text-neutral-600 prose-table:text-sm prose-th:bg-neutral-50 prose-th:px-4 prose-th:py-2 prose-td:px-4 prose-td:py-2"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown content is parsed and sanitized
              dangerouslySetInnerHTML={{ __html: entry.htmlContent }}
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

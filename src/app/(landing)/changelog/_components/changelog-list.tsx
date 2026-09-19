import { format, parseISO } from "date-fns";

import { cn } from "@/lib/utils";
import "@/styles/site-content.css";

import { bodyClass, cardClass, leadClass } from "../../_components/site-primitives";

import type { ChangelogCategory, ChangelogEntry } from "@/lib/changelog";

const categoryLabels = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  shipped: "Shipped",
} satisfies Record<ChangelogCategory, string>;

export function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="py-20">
        <p className={cn(cardClass, bodyClass, "mx-auto max-w-md p-10 text-center")}>
          No releases yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry) => (
        <Entry key={entry.slug} entry={entry} />
      ))}
    </div>
  );
}

function Entry({ entry }: { entry: ChangelogEntry }) {
  const date = parseISO(entry.date);

  return (
    <article
      id={entry.slug}
      className="scroll-mt-24 gap-x-8 border-t border-neutral-950/[0.07] py-12 first:border-t-0 md:grid md:grid-cols-[12rem_minmax(0,1fr)]"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 self-start md:sticky md:top-24 md:flex-col md:items-start">
        <time dateTime={entry.date} className="font-mono text-sm text-neutral-600">
          {format(date, "MMMM d, yyyy")}
        </time>
        <span className="font-mono text-sm text-neutral-600">v{entry.version}</span>
        <span
          className={cn(
            "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
            entry.category === "new"
              ? "bg-neutral-900 text-white"
              : "bg-neutral-950/[0.06] text-neutral-800",
          )}
        >
          {categoryLabels[entry.category] ?? "Update"}
        </span>
      </div>

      <div className="mt-4 min-w-0 md:mt-0">
        <h2 className="text-balance font-title text-2xl font-semibold tracking-tight text-neutral-900">
          {entry.title}
        </h2>
        {entry.shortDesc && <p className={cn(leadClass, "mt-3 max-w-[60ch]")}>{entry.shortDesc}</p>}
        <div
          className="site-prose site-prose-compact mt-6"
          dangerouslySetInnerHTML={{ __html: entry.htmlContent }}
        />
      </div>
    </article>
  );
}

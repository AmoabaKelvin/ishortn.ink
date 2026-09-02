import { format, parseISO } from "date-fns";

import type { ChangelogCategory, ChangelogEntry } from "@/lib/changelog";

const categoryLabels: Record<ChangelogCategory, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  shipped: "Shipped",
};

export function ChangelogList({ entries }: { entries: ChangelogEntry[] }) {
  if (entries.length === 0) {
    return <p className="cl-empty">No releases yet.</p>;
  }

  return (
    <div className="cl-list">
      {entries.map((entry) => (
        <Entry key={entry.slug} entry={entry} />
      ))}
    </div>
  );
}

function Entry({ entry }: { entry: ChangelogEntry }) {
  const date = parseISO(entry.date);

  return (
    <article id={entry.slug} className="cl-entry">
      <div className="cl-meta">
        <time dateTime={entry.date}>{format(date, "MMMM d, yyyy")}</time>
        <span className="cl-version">v{entry.version}</span>
        <span className={`cl-tag cl-tag-${entry.category}`}>
          {categoryLabels[entry.category] ?? "Update"}
        </span>
      </div>

      <div className="cl-body">
        <h2 className="cl-entry-title">{entry.title}</h2>
        {entry.shortDesc && <p className="cl-lede">{entry.shortDesc}</p>}
        <div
          className="cl-prose"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown content is parsed server-side via remark
          dangerouslySetInnerHTML={{ __html: entry.htmlContent }}
        />
      </div>
    </article>
  );
}

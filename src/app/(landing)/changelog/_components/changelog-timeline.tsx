"use client";

import { format, parseISO } from "date-fns";
import { Fragment, useEffect, useState } from "react";

import type { ChangelogCategory, ChangelogEntry } from "@/lib/changelog";

import { Icon } from "../../_components/warm-primitives";

const categoryLabels: Record<ChangelogCategory, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  shipped: "Shipped",
};

interface ChangelogTimelineProps {
  entries: ChangelogEntry[];
}

export function ChangelogTimeline({ entries }: ChangelogTimelineProps) {
  const [active, setActive] = useState<string>(entries[0]?.slug ?? "");

  useEffect(() => {
    if (entries.length === 0) return undefined;
    const obs = new IntersectionObserver(
      (observed) => {
        observed.forEach((en) => {
          if (en.isIntersecting) setActive(en.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    entries.forEach((entry) => {
      const el = document.getElementById(entry.slug);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div
        style={{
          borderRadius: 24,
          border: "1px solid var(--warm-line)",
          background: "var(--warm-paper)",
          padding: 64,
          textAlign: "center",
          color: "var(--warm-mute)",
          fontSize: 14,
        }}
      >
        No changelog entries yet.
      </div>
    );
  }

  return (
    <div className="warm-container cl-grid">
      <aside className="cl-rail">
        <div className="cl-rail-label">Releases</div>
        {entries.map((e) => (
          <a
            key={e.slug}
            href={`#${e.slug}`}
            className={active === e.slug ? "cl-rail-active" : ""}
          >
            <div style={{ fontWeight: 500 }}>v{e.version}</div>
            <div
              style={{
                fontSize: 12,
                color: "var(--warm-mute)",
                marginTop: 2,
              }}
            >
              {format(parseISO(e.date), "MMM d")}
            </div>
          </a>
        ))}
        <div
          style={{
            marginTop: 40,
            paddingTop: 24,
            borderTop: "1px solid var(--warm-line-soft)",
          }}
        >
          <div className="cl-rail-label">Follow along</div>
          <a href="/rss" style={{ color: "var(--warm-ink-soft)" }}>
            RSS feed →
          </a>
          <a
            href="https://twitter.com/kelamoaba"
            style={{ color: "var(--warm-ink-soft)" }}
          >
            @ishortn on X →
          </a>
        </div>
      </aside>

      <main>
        <section className="cl-subscribe">
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--font-warm-display)",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              Get the changelog in your inbox.
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--warm-mute)",
                marginTop: 4,
              }}
            >
              One email per release. No marketing. Unsubscribe instantly.
            </div>
          </div>
          <form
            className="cl-subscribe-form"
            onSubmit={(event) => event.preventDefault()}
          >
            <input
              type="email"
              placeholder="you@studio.co"
              aria-label="Email address"
            />
            <button
              type="submit"
              className="warm-btn warm-btn-accent"
              style={{ padding: "10px 20px" }}
            >
              Subscribe
            </button>
          </form>
        </section>

        {entries.map((entry, index) => (
          <Fragment key={entry.slug}>
            <Entry entry={entry} isFirst={index === 0} />
            {index < entries.length - 1 && (
              <div className="cl-divider">
                <span className="warm-italic" style={{ fontStyle: "italic" }}>
                  ·&nbsp;&nbsp;·&nbsp;&nbsp;·
                </span>
              </div>
            )}
          </Fragment>
        ))}

        <a href="#top" className="cl-older">
          Back to top <Icon.Arrow />
        </a>
      </main>
    </div>
  );
}

function Entry({
  entry,
  isFirst,
}: {
  entry: ChangelogEntry;
  isFirst: boolean;
}) {
  const date = parseISO(entry.date);
  const category = categoryLabels[entry.category] ?? "Update";

  return (
    <article id={entry.slug} className="cl-entry">
      <div className="cl-entry-meta">
        <span className="cl-entry-date">{format(date, "MMMM d, yyyy")}</span>
        <span className="cl-entry-version">v{entry.version}</span>
        <span className={`cl-tag cl-tag-${entry.category}`}>{category}</span>
        {isFirst && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--warm-sage-deep)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--warm-sage)",
              }}
            />
            Latest
          </span>
        )}
      </div>
      <h2 className="cl-entry-title">{entry.title}</h2>
      {entry.shortDesc && <p className="cl-entry-lede">{entry.shortDesc}</p>}
      <div
        className="cl-entry-prose"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown content is parsed server-side via remark
        dangerouslySetInnerHTML={{ __html: entry.htmlContent }}
      />
    </article>
  );
}

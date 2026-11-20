"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import type { DocsHeading } from "@/lib/docs/utils";

/** "On this page" list; highlights the section currently at the top of the viewport. */
export function DocsToc({ headings }: { headings: DocsHeading[] }) {
  const [activeId, setActiveId] = useState<string | undefined>(headings[0]?.id);

  useEffect(() => {
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const onScroll = () => {
      // The last heading scrolled past the sticky header is the current section.
      const offset = 120;
      let current = elements[0]?.id;
      for (const element of elements) {
        if (element.getBoundingClientRect().top - offset <= 0) current = element.id;
        else break;
      }
      setActiveId(current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-labelledby="docs-toc-title">
      <h2 id="docs-toc-title" className="text-sm font-semibold text-neutral-900 dark:text-white">
        On this page
      </h2>
      <ul className="mt-3 space-y-2 border-l border-neutral-950/[0.07] dark:border-white/10">
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "-ml-px block border-l py-0.5 text-sm",
                  heading.depth === 3 ? "pl-6" : "pl-3",
                  active
                    ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
                    : "border-transparent text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white",
                )}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

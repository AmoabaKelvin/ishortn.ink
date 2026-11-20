"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOCS_SECTIONS, docsHref } from "@/lib/docs/navigation";
import { cn } from "@/lib/utils";

/** Section-grouped page list, shared by the desktop sidebar and the mobile menu. */
export function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="space-y-8">
      {DOCS_SECTIONS.map((section) => (
        <div key={section.title}>
          <h2 className="px-2.5 font-title text-base font-semibold text-neutral-900 sm:text-sm dark:text-white">
            {section.title}
          </h2>
          <ul className="mt-2 space-y-0.5">
            {section.pages.map((page) => {
              const href = docsHref(page.slug);
              const active = pathname === href;
              return (
                <li key={page.slug}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-2.5 py-2 text-base sm:py-1.5 sm:text-sm",
                      active
                        ? "bg-neutral-950/[0.06] text-neutral-900 dark:bg-white/10 dark:text-white"
                        : "text-neutral-600 hover:bg-neutral-950/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white",
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

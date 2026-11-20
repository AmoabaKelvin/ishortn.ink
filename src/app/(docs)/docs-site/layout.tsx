import "@/styles/docs.css";
import { DocsHeader } from "./_components/docs-header";
import { DocsNav } from "./_components/docs-nav";

import type { ReactNode } from "react";

// Served at /docs on the app host; src/middleware.ts rewrites /docs/* here.
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="docs-root min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <a
        href="#docs-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-site-card dark:focus:bg-neutral-900"
      >
        Skip to content
      </a>
      <DocsHeader />
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-10 lg:px-8">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto py-10 pr-2 lg:block">
          <DocsNav />
        </aside>
        {children}
      </div>
    </div>
  );
}

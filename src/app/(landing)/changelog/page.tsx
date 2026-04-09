import { Suspense } from "react";

import type { Metadata } from "next";

import { getChangelogEntries } from "@/lib/changelog";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { ChangelogHero } from "./_components/changelog-hero";
import { ChangelogTimeline } from "./_components/changelog-timeline";

export const metadata: Metadata = {
  title: "Changelog - iShortn",
  description:
    "Stay up to date with the latest features, improvements, and fixes to iShortn.",
  openGraph: {
    title: "Changelog - iShortn",
    description:
      "Stay up to date with the latest features, improvements, and fixes to iShortn.",
    type: "website",
  },
};

export default async function ChangelogPage() {
  const entries = await getChangelogEntries();

  return (
    <main className="relative bg-white dark:bg-card">
      <Header />
      <ChangelogHero />

      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-200 dark:border-border border-t-neutral-900 dark:border-t-foreground" />
              </div>
            }
          >
            <ChangelogTimeline entries={entries} />
          </Suspense>
        </div>
      </section>

      <Footer />
    </main>
  );
}

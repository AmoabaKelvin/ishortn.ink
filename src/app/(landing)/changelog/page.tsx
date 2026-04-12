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
    <main className="relative bg-zinc-950">
      <Header />
      <ChangelogHero />

      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-800 border-t-blue-500" />
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

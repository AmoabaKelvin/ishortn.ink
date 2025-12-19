import { Suspense } from "react";
import type { Metadata } from "next";
import { getChangelogEntries } from "@/lib/changelog";
import { Header } from "../_components/header";
import { Footer } from "../_components/footer";
import { ChangelogTimeline } from "./_components/changelog-timeline";
import { ChangelogHero } from "./_components/changelog-hero";

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
    <main className="relative min-h-screen">
      <Header />

      <ChangelogHero />

      <section className="relative px-4 pb-24">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-50/50 via-white to-white" />
        <div className="noise-overlay" />

        <div className="relative z-10 mx-auto max-w-4xl">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
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

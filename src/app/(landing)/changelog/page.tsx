import { Suspense } from "react";

import type { Metadata } from "next";

import { getChangelogEntries } from "@/lib/changelog";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { ChangelogHero } from "./_components/changelog-hero";
import { ChangelogTimeline } from "./_components/changelog-timeline";

export const metadata: Metadata = {
  title: "Changelog — iShortn",
  description:
    "A public log of every iShortn release. New features, improvements, and fixes, written like letters — not press notes.",
  openGraph: {
    title: "Changelog — iShortn",
    description:
      "A public log of every iShortn release. New features, improvements, and fixes.",
    type: "website",
  },
};

export default async function ChangelogPage() {
  const entries = await getChangelogEntries();

  return (
    <main style={{ background: "var(--warm-bg)", color: "var(--warm-ink)" }}>
      <Header />
      <span id="top" />
      <ChangelogHero />

      <Suspense
        fallback={
          <div
            style={{
              display: "grid",
              placeItems: "center",
              padding: "80px 0",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: "2px solid var(--warm-line)",
                borderTopColor: "var(--warm-accent)",
                animation: "warm-spin .75s linear infinite",
              }}
            />
            <style>{`@keyframes warm-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        }
      >
        <ChangelogTimeline entries={entries} />
      </Suspense>

      <Footer />
    </main>
  );
}

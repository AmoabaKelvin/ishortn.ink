import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { getChangelogEntries } from "@/lib/changelog";
import { createBreadcrumbSchema } from "@/lib/seo/structured-data";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { ChangelogList } from "./_components/changelog-list";

export const metadata: Metadata = {
  title: "Changelog — iShortn",
  description: "Every iShortn release in order: new features, improvements, and fixes.",
  openGraph: {
    title: "Changelog — iShortn",
    description: "Every iShortn release in order: new features, improvements, and fixes.",
    type: "website",
  },
};

export default async function ChangelogPage() {
  const entries = await getChangelogEntries();

  return (
    <main style={{ background: "var(--warm-bg)", color: "var(--warm-ink)" }}>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Changelog", url: "https://ishortn.ink/changelog" },
        ])}
      />
      <Header />

      <section className="cl-header">
        <div className="warm-container">
          <h1 className="cl-title">Changelog</h1>
          <p className="cl-subtitle">
            Every release in order. New features, improvements, and fixes.
          </p>
        </div>
      </section>

      <section className="cl-section">
        <div className="warm-container">
          <ChangelogList entries={entries} />
        </div>
      </section>

      <Footer />
    </main>
  );
}

import { IconBoltFilled } from "@tabler/icons-react";

import { JsonLd } from "@/components/seo/json-ld";
import { getChangelogEntries } from "@/lib/changelog";
import { createBreadcrumbSchema } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { Eyebrow, h1Class, leadClass, Section } from "../_components/site-primitives";
import { ChangelogList } from "./_components/changelog-list";

import type { Metadata } from "next";

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
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Changelog", url: "https://ishortn.ink/changelog" },
        ])}
      />
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconBoltFilled aria-hidden="true" />}>Changelog</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>What&apos;s new in iShortn</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Every release in order. New features, improvements, and fixes.
          </p>
        </div>
      </Section>

      <Section className="py-6 sm:py-10">
        <ChangelogList entries={entries} />
      </Section>

      <Footer />
    </main>
  );
}

import { IconStackFilled } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { JsonLd } from "@/components/seo/json-ld";
import { solutionsHubTitle } from "@/lib/seo/solutions";
import { createBreadcrumbSchema } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../_components/cta";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { Eyebrow, h1Class, leadClass, Section } from "../_components/site-primitives";
import { SolutionCards } from "../_components/solution-cards";

import type { Metadata } from "next";

const description =
  "How shops, creators, restaurants, agencies, churches, event organisers and real estate agents use iShortn for QR codes, short links and bio pages.";

const inlineLinkClass =
  "font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900";

export const metadata: Metadata = {
  title: { absolute: solutionsHubTitle },
  description,
  alternates: { canonical: "/solutions" },
  openGraph: {
    title: solutionsHubTitle,
    description,
    type: "website",
    url: "https://ishortn.ink/solutions",
  },
};

export default function SolutionsHubPage() {
  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Solutions", url: "https://ishortn.ink/solutions" },
        ])}
      />
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconStackFilled aria-hidden="true" />}>Solutions</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>
            Short links and QR codes for your line of work
          </h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Pick your field to see what iShortn does for it, which plan fits and what it costs.
          </p>
        </div>
      </Section>

      <Section>
        <SolutionCards />
        <p className="mx-auto mt-10 max-w-4xl text-pretty text-center text-base text-neutral-600 sm:text-sm">
          Weighing up other tools? See{" "}
          <Link href="/compare" className={inlineLinkClass}>
            how iShortn compares
          </Link>{" "}
          with Bitly, TinyURL and others, or read our{" "}
          <Link href="/blog" className={inlineLinkClass}>
            guides
          </Link>
          .
        </p>
      </Section>

      <CTA />
      <Footer />
    </main>
  );
}

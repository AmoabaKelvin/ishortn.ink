import { IconChevronRight, IconScaleFilled } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { JsonLd } from "@/components/seo/json-ld";
import { competitors } from "@/lib/seo/competitors";
import { createBreadcrumbSchema } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../_components/cta";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import {
  bodyClass,
  cardClass,
  Eyebrow,
  h1Class,
  h3Class,
  leadClass,
  Section,
} from "../_components/site-primitives";

import type { Metadata } from "next";

const list = Object.values(competitors);
const names = new Intl.ListFormat("en-US", { type: "conjunction" }).format(list.map((c) => c.name));
const description = `Compare iShortn with ${names}. See features, free plan limits, and pricing side by side.`;

export const metadata: Metadata = {
  title: "iShortn vs Other Link Shorteners",
  description,
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "iShortn vs Other Link Shorteners — iShortn",
    description,
    type: "website",
    url: "https://ishortn.ink/compare",
  },
};

export default function CompareHubPage() {
  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Compare", url: "https://ishortn.ink/compare" },
        ])}
      />
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconScaleFilled aria-hidden="true" />}>Compare</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>iShortn vs other link shorteners</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            See how iShortn stacks up on features, free plan limits, and pricing.
          </p>
        </div>
      </Section>

      <Section>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((competitor) => (
            <li key={competitor.slug} className="flex">
              <Link
                href={`/compare/${competitor.slug}`}
                className={cn(cardClass, "flex w-full flex-col p-6 hover:bg-neutral-50")}
              >
                <h2 className={cn(h3Class, "text-balance")}>iShortn vs {competitor.name}</h2>
                <p className={cn(bodyClass, "mt-2")}>{competitor.tagline}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium text-neutral-900">
                  See comparison
                  <IconChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-70" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <CTA />
      <Footer />
    </main>
  );
}

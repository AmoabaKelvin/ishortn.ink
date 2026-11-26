import { IconScaleFilled, IconSparklesFilled, IconStackFilled } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { JsonLd } from "@/components/seo/json-ld";
import { competitors } from "@/lib/seo/competitors";
import { createBreadcrumbSchema, softwareApplicationSchema } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../_components/cta";
import { DashboardPreview } from "../_components/dashboard-preview";
import { Features } from "../_components/features";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { QRSection } from "../_components/qr-section";
import { FreeTools, Guides } from "../_components/resources";
import {
  Eyebrow,
  h1Class,
  leadClass,
  Section,
  SectionHeading,
} from "../_components/site-primitives";
import { SolutionCards } from "../_components/solution-cards";

import type { Metadata } from "next";

// Guides reads the clock, so a curated post scheduled for a future date appears on its day.
export const revalidate = 3600;

const description =
  "Click analytics by country, device and referrer, dynamic QR codes that never expire, custom domains, bio pages, bulk import, team workspaces and a REST API.";

export const metadata: Metadata = {
  title: "URL Shortener Features: Analytics, QR Codes, Domains",
  description,
  keywords: [
    "url shortener features",
    "link analytics",
    "custom domains",
    "qr code generator",
    "link management features",
  ],
  openGraph: {
    title: "URL Shortener Features | iShortn",
    description,
    type: "website",
  },
};

// Keyed by `competitors`, so a removed comparison fails the typecheck instead of linking a 404.
const comparisons: { key: keyof typeof competitors; label: string }[] = [
  { key: "bitly", label: "iShortn vs Bitly" },
  { key: "short-io", label: "vs Short.io" },
  { key: "dub", label: "vs Dub" },
  { key: "rebrandly", label: "vs Rebrandly" },
  { key: "tinyurl", label: "vs TinyURL" },
  { key: "linktree", label: "vs Linktree" },
];
const comparisonLinks = [
  { href: "/compare", label: "All comparisons" },
  ...comparisons.map(({ key, label }) => ({ href: `/compare/${competitors[key].slug}`, label })),
];

export default function FeaturesPage() {
  return (
    <main>
      <JsonLd data={softwareApplicationSchema} />
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Features", url: "https://ishortn.ink/features" },
        ])}
      />
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>Features</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>
            Everything you need to manage your links
          </h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Real-time analytics, custom domains, branded QR codes, and bulk shortening in one place.
          </p>
        </div>
      </Section>

      <Features />
      <DashboardPreview />
      <QRSection />
      <FreeTools />
      <Guides />

      <Section>
        <SectionHeading
          align="left"
          eyebrow={<Eyebrow icon={<IconStackFilled aria-hidden="true" />}>Solutions</Eyebrow>}
          title="Built for your line of work"
        />
        <div className="mt-14">
          <SolutionCards headingLevel="h3" />
        </div>
      </Section>

      <Section>
        <SectionHeading
          align="left"
          eyebrow={<Eyebrow icon={<IconScaleFilled aria-hidden="true" />}>Compare</Eyebrow>}
          title="How iShortn compares"
        />
        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
          {comparisonLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-base font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
              >
                {link.label}
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

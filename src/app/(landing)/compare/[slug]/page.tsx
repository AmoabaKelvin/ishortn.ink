import {
  IconCheck,
  IconLayoutGridFilled,
  IconScaleFilled,
  IconSparklesFilled,
  IconTagFilled,
} from "@tabler/icons-react";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { Paths } from "@/lib/constants/app";
import { competitors, type Competitor } from "@/lib/seo/competitors";
import { createBreadcrumbSchema } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../../_components/cta";
import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";
import {
  bodyClass,
  ButtonLink,
  cardClass,
  Eyebrow,
  h1Class,
  h3Class,
  leadClass,
  Section,
  SectionHeading,
} from "../../_components/site-primitives";

import type { Metadata } from "next";

export function generateStaticParams() {
  return Object.values(competitors).map((c) => ({ slug: c.slug }));
}

function getCompetitor(slug: string): Competitor | undefined {
  return Object.values(competitors).find((c) => c.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) return {};

  const title = `${competitor.name} vs iShortn — URL shortener comparison`;
  const description = `Compare ${competitor.name} and iShortn side by side. See features, pricing, and why creators and small teams pick iShortn.`;

  return {
    title,
    description,
    keywords: [
      `${competitor.name.toLowerCase()} alternative`,
      `${competitor.name.toLowerCase()} vs ishortn`,
      `${competitor.slug} alternative`,
      "url shortener comparison",
      "best url shortener",
      "link shortener alternative",
    ],
    openGraph: { title, description, type: "website" },
  };
}

const ishortn = {
  freeLinks: "30/month on Free, 1,000 on Pro, unlimited on Ultra",
  freeAnalytics: "7 days on Free, unlimited on Pro and Ultra",
  customDomains: "3 on Pro, unlimited on Ultra",
  qrCodes: "All plans — branded + dynamic on Pro and Ultra",
  apiAccess: "Pro and Ultra",
  teamFeatures: "Ultra plan",
  passwordProtection: "Pro and Ultra",
  pricing: "Free forever, Pro $8/mo, Ultra $15/mo",
};

type FeatureRow = {
  label: string;
  competitorKey: keyof typeof ishortn;
};

const featureRows: FeatureRow[] = [
  { label: "Free links", competitorKey: "freeLinks" },
  { label: "Analytics", competitorKey: "freeAnalytics" },
  { label: "Custom domains", competitorKey: "customDomains" },
  { label: "QR codes", competitorKey: "qrCodes" },
  { label: "API access", competitorKey: "apiAccess" },
  { label: "Team features", competitorKey: "teamFeatures" },
  { label: "Password protection", competitorKey: "passwordProtection" },
  { label: "Pricing", competitorKey: "pricing" },
];

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) return notFound();

  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          {
            name: `${competitor.name} vs iShortn`,
            url: `https://ishortn.ink/compare/${competitor.slug}`,
          },
        ])}
      />
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconScaleFilled aria-hidden="true" />}>Comparison</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>iShortn vs {competitor.name}</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>{competitor.description}</p>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconLayoutGridFilled aria-hidden="true" />}>Features</Eyebrow>}
          title="Feature by feature, side by side"
        />
        <div className={cn(cardClass, "mt-14 overflow-x-auto")}>
          <table className="w-full min-w-[640px] border-collapse text-left text-base sm:text-sm">
            <thead>
              <tr className="border-b border-neutral-950/[0.07]">
                <th scope="col" className="w-1/4 px-6 py-4 font-medium text-neutral-600">
                  Feature
                </th>
                <th scope="col" className="px-6 py-4 font-medium text-neutral-600">
                  {competitor.name}
                </th>
                <th scope="col" className="bg-neutral-50 px-6 py-4 font-medium text-neutral-900">
                  iShortn
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-950/[0.07]">
              {featureRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-6 py-4 align-top font-medium text-neutral-900">
                    {row.label}
                  </th>
                  <td className="px-6 py-4 align-top text-neutral-600">
                    {competitor[row.competitorKey]}
                  </td>
                  <td className="bg-neutral-50 px-6 py-4 align-top text-neutral-900">
                    {ishortn[row.competitorKey]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>Why switch</Eyebrow>}
          title={`Why teams switch from ${competitor.name}`}
        />
        <ul className="mt-14 grid gap-4 md:grid-cols-2">
          {competitor.whySwitch.map((reason) => (
            <li key={reason} className={cn(cardClass, "flex items-start gap-3 p-6")}>
              <IconCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-neutral-900" />
              <span className={bodyClass}>{reason}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconTagFilled aria-hidden="true" />}>Pricing</Eyebrow>}
          title="How the pricing compares"
        />
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          <div className={cn(cardClass, "p-6 sm:p-8")}>
            <h3 className={h3Class}>{competitor.name}</h3>
            <p className="mt-1 text-base text-neutral-600 sm:text-sm">{competitor.tagline}</p>
            <p className={cn(bodyClass, "mt-5")}>{competitor.pricing}</p>
          </div>

          <div className={cn(cardClass, "flex flex-col justify-between p-6 sm:p-8")}>
            <div>
              <h3 className={h3Class}>iShortn</h3>
              <p className="mt-1 text-base text-neutral-600 sm:text-sm">
                Free forever, Pro $8/mo, Ultra $15/mo
              </p>
              <dl className="mt-5 space-y-3">
                <div>
                  <dt className="inline font-medium text-neutral-900">Free: </dt>
                  <dd className={cn(bodyClass, "inline")}>
                    30 links/month, 1,000 tracked events, 7-day analytics.
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium text-neutral-900">Pro $8/mo: </dt>
                  <dd className={cn(bodyClass, "inline")}>
                    1,000 links/month, 10,000 tracked events, unlimited analytics history, 3 custom
                    domains, branded + dynamic QR codes, REST API.
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium text-neutral-900">Ultra $15/mo: </dt>
                  <dd className={cn(bodyClass, "inline")}>
                    Everything in Pro plus unlimited links and events, unlimited custom domains,
                    team workspaces, resource transfer.
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mt-8">
              <ButtonLink href={Paths.Signup} variant="secondary">
                Start free
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>

      <CTA />
      <Footer />
    </main>
  );
}

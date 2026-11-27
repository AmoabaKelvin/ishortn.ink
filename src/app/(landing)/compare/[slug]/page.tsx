import {
  IconCheck,
  IconLayoutGridFilled,
  IconScaleFilled,
  IconShieldCheckFilled,
  IconSparklesFilled,
  IconTagFilled,
  IconTruckFilled,
} from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/json-ld";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { getActivePromo, promoBannerText } from "@/lib/billing/promo";
import { isPostLive } from "@/lib/blog";
import { Paths } from "@/lib/constants/app";
import { linkOwnershipPoints } from "@/lib/copy/link-ownership";
import { comparisonTitle, competitors, getCompetitor } from "@/lib/seo/competitors";
import { visibleRelatedLinks } from "@/lib/seo/related-links";
import { createBreadcrumbSchema, createFaqSchema } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../../_components/cta";
import { Faq } from "../../_components/faq";
import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";
import { RelatedReading } from "../../_components/related-reading";
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
  StepChip,
} from "../../_components/site-primitives";

import type { Metadata } from "next";

// 5-minute ISR, matching /pricing, so the promo line follows the promo window; it also picks up
// a scheduled guide's link on its publish date.
export const revalidate = 300;

export function generateStaticParams() {
  return Object.values(competitors).map((c) => ({ slug: c.slug }));
}

function formatCheckedDate(iso: string) {
  // UTC so the build machine's timezone can't shift the date by a day.
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) return {};

  // Absolute so the root "| iShortn" template doesn't repeat the brand already in the title.
  const title = comparisonTitle(competitor);
  const description =
    "metaDescription" in competitor
      ? competitor.metaDescription
      : `Compare ${competitor.name} and iShortn in a side-by-side ${competitor.category} comparison. See features, pricing, and why creators and small teams pick iShortn.`;

  return {
    title: { absolute: title },
    description,
    keywords: [
      `${competitor.name.toLowerCase()} alternative`,
      `${competitor.name.toLowerCase()} vs ishortn`,
      `${competitor.slug} alternative`,
      `${competitor.category.toLowerCase()} comparison`,
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
  qrCodes:
    "5 dynamic QR codes on Free (edit anytime, never expire, no ads), branded on Pro and Ultra",
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

// Link-in-bio comparisons put iShortn's bio page limits next to the competitor's bio page instead
// of the short-link quota. Numbers come from PLAN_CAPS so a plan change can't leave stale copy.
const countLabel = (limit: number | undefined, noun: string) =>
  limit === undefined ? `unlimited ${noun}s` : `${limit} ${limit === 1 ? noun : `${noun}s`}`;

const freeCaps = PLAN_CAPS.free;
const proCaps = PLAN_CAPS.pro;

const bioLinksLabel = "Links on the bio page";
const ishortnBioLinks = `Up to ${countLabel(freeCaps.bioLinkBlocksPerPageLimit, "link block")} per page on Free (${countLabel(freeCaps.bioPageLimit, "page")}); no limit on Pro (${countLabel(proCaps.bioPageLimit, "page")}) and Ultra. Plus ${freeCaps.linksLimit} short links/month on Free.`;
const freeBioPlanLine = `${countLabel(freeCaps.bioPageLimit, "bio page")} with up to ${countLabel(freeCaps.bioLinkBlocksPerPageLimit, "link block")}.`;
const proBioPlanLine = `${countLabel(proCaps.bioPageLimit, "bio page")} on your own domain, no iShortn badge.`;

const guideLinkClass =
  "font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900";

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) return notFound();

  const isLinkInBio = competitor.category === "link in bio";
  const promo = getActivePromo();
  const rows = isLinkInBio
    ? featureRows.map((row) =>
        row.competitorKey === "freeLinks" ? { ...row, label: bioLinksLabel } : row,
      )
    : featureRows;
  const ishortnValues = isLinkInBio ? { ...ishortn, freeLinks: ishortnBioLinks } : ishortn;

  const guide =
    "guide" in competitor && isPostLive(competitor.guide.slug) ? competitor.guide : null;
  // With migration steps, the migration guide link sits under the steps instead of "Why switch".
  const migrationSteps = "migrationSteps" in competitor ? competitor.migrationSteps : null;
  const migrationGuide = "migrationGuide" in competitor ? competitor.migrationGuide : null;
  const whySwitchMigrationGuide = migrationSteps ? null : migrationGuide;

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
      {"faqs" in competitor && <JsonLd data={createFaqSchema([...competitor.faqs])} />}
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
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-6 py-4 align-top font-medium text-neutral-900">
                    {row.label}
                  </th>
                  <td className="px-6 py-4 align-top text-neutral-600">
                    {competitor[row.competitorKey]}
                  </td>
                  <td className="bg-neutral-50 px-6 py-4 align-top text-neutral-900">
                    {ishortnValues[row.competitorKey]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-base text-neutral-600 sm:text-sm">
          {competitor.name} prices checked on{" "}
          <time dateTime={competitor.pricesCheckedOn}>
            {formatCheckedDate(competitor.pricesCheckedOn)}
          </time>
          .
        </p>
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
        {whySwitchMigrationGuide && (
          <p className={cn(bodyClass, "mt-8")}>
            <Link href={whySwitchMigrationGuide.href} className={guideLinkClass}>
              {whySwitchMigrationGuide.label}
            </Link>
          </p>
        )}
        {guide && (
          <p className={cn(bodyClass, whySwitchMigrationGuide ? "mt-3" : "mt-8")}>
            <Link href={`/blog/${guide.slug}`} className={guideLinkClass}>
              {guide.label}
            </Link>
          </p>
        )}
      </Section>

      {"linksStayYours" in competitor && (
        <Section>
          <SectionHeading
            eyebrow={
              <Eyebrow icon={<IconShieldCheckFilled aria-hidden="true" />}>Ownership</Eyebrow>
            }
            title="Your links stay yours"
          />
          <ul className="mt-14 grid gap-4 md:grid-cols-2">
            {linkOwnershipPoints.map((point) => (
              <li key={point} className={cn(cardClass, "flex items-start gap-3 p-6")}>
                <IconCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-neutral-900" />
                <span className={bodyClass}>{point}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {migrationSteps && (
        <Section>
          <SectionHeading
            eyebrow={<Eyebrow icon={<IconTruckFilled aria-hidden="true" />}>Migration</Eyebrow>}
            title={`How to move from ${competitor.name}`}
          />
          <ol className="mx-auto mt-14 max-w-4xl space-y-4">
            {migrationSteps.map((step, i) => (
              <li key={step} className={cn(cardClass, "flex items-start gap-4 p-6")}>
                <StepChip>{String(i + 1).padStart(2, "0")}</StepChip>
                <span className={bodyClass}>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mx-auto mt-8 max-w-4xl space-y-3">
            {migrationGuide && (
              <p className={bodyClass}>
                <Link href={migrationGuide.href} className={guideLinkClass}>
                  {migrationGuide.label}
                </Link>
              </p>
            )}
            <p className={bodyClass}>
              <Link href="/docs/bulk-import" className={guideLinkClass}>
                CSV bulk import
              </Link>
            </p>
          </div>
        </Section>
      )}

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
                    30 links/month, 1,000 tracked events, 7-day analytics, 5 dynamic QR codes.
                    {isLinkInBio && ` ${freeBioPlanLine}`}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium text-neutral-900">Pro $8/mo: </dt>
                  <dd className={cn(bodyClass, "inline")}>
                    1,000 links/month, 10,000 tracked events, 1 year of detailed analytics, 3 custom
                    domains, branded + dynamic QR codes, REST API.
                    {isLinkInBio && ` ${proBioPlanLine}`}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium text-neutral-900">Ultra $15/mo: </dt>
                  <dd className={cn(bodyClass, "inline")}>
                    Everything in Pro plus unlimited links and events, unlimited custom domains,
                    team workspaces, link cloaking, priority support.
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mt-8">
              {promo && <p className={cn(bodyClass, "mb-4")}>{promoBannerText(promo)}</p>}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <ButtonLink href={Paths.Signup} variant="secondary">
                  Start free
                </ButtonLink>
                <Link href="/pricing" className={cn(bodyClass, guideLinkClass)}>
                  See all plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {"faqs" in competitor && (
        <Faq
          faqs={competitor.faqs.map((f) => ({ q: f.question, a: f.answer }))}
          title={`${competitor.name} vs iShortn: common questions`}
          subtitle="Answers use each company's own pricing page."
        />
      )}

      {"relatedGuides" in competitor && (
        <RelatedReading links={visibleRelatedLinks([...competitor.relatedGuides])} />
      )}

      <CTA />
      <Footer />
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";

import { competitors, type Competitor } from "@/lib/seo/competitors";

/* ---------- Static generation ---------- */

export function generateStaticParams() {
  return Object.values(competitors).map((c) => ({ slug: c.slug }));
}

/* ---------- Dynamic metadata ---------- */

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

  const title = `${competitor.name} vs iShortn - Compare URL Shorteners | iShortn`;
  const description = `Compare ${competitor.name} and iShortn side by side. See features, pricing, and why iShortn is the best ${competitor.name} alternative.`;

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
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}

/* ---------- iShortn feature data ---------- */

const ishortn = {
  freeLinks: "30/month",
  freeAnalytics: "7 days (unlimited on Pro)",
  customDomains: "Up to 3 on Pro",
  qrCodes: "All plans",
  apiAccess: "Pro and Ultra",
  teamFeatures: "Ultra plan",
  passwordProtection: "All plans",
  pricing: "Free, Pro $5/mo, Ultra $15/mo",
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

/* ---------- Page component ---------- */

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) return notFound();

  return (
    <main className="relative bg-white dark:bg-card">
      <Header />

      {/* Hero */}
      <section className="px-6 pt-32 pb-12 md:pt-40 md:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Comparison
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-neutral-900 dark:text-foreground sm:text-5xl">
            {competitor.name} vs iShortn
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
            {competitor.description}
          </p>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Feature-by-feature comparison
          </h2>

          <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-border">
            {/* Table header */}
            <div className="grid grid-cols-3 border-b border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50">
              <div className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Feature
              </div>
              <div className="border-l border-neutral-200 dark:border-border px-5 py-4 text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {competitor.name}
              </div>
              <div className="border-l border-neutral-200 dark:border-border bg-neutral-900 px-5 py-4 text-xs font-medium uppercase tracking-wider text-white">
                iShortn
              </div>
            </div>

            {/* Table rows */}
            {featureRows.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-3 ${
                  i < featureRows.length - 1
                    ? "border-b border-neutral-100 dark:border-border/50"
                    : ""
                }`}
              >
                <div className="px-5 py-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {row.label}
                </div>
                <div className="border-l border-neutral-100 dark:border-border/50 px-5 py-4 text-sm text-neutral-500 dark:text-neutral-400">
                  {competitor[row.competitorKey]}
                </div>
                <div className="border-l border-neutral-100 dark:border-border/50 bg-neutral-50 dark:bg-accent/50 px-5 py-4 text-sm font-medium text-neutral-900 dark:text-foreground">
                  {ishortn[row.competitorKey]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why teams switch */}
      <section className="border-t border-neutral-100 dark:border-border/50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Why teams switch from {competitor.name} to iShortn
          </h2>
          <ul className="space-y-4">
            {competitor.whySwitch.map((reason) => (
              <li key={reason} className="flex items-start gap-3">
                <span className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                <span className="text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing comparison */}
      <section className="border-t border-neutral-100 dark:border-border/50 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Pricing comparison
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Competitor pricing */}
            <div className="rounded-xl border border-neutral-200 dark:border-border p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-foreground">
                {competitor.name}
              </h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {competitor.tagline}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {competitor.pricing}
              </p>
            </div>

            {/* iShortn pricing */}
            <div className="rounded-xl border-2 border-neutral-900 dark:border-foreground p-6">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-foreground">
                iShortn
              </h3>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                Simple, powerful link shortening
              </p>
              <div className="mt-4 space-y-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                <p>
                  <span className="font-medium text-neutral-900 dark:text-foreground">Free</span> --
                  30 links/month, 1,000 events, 7-day analytics
                </p>
                <p>
                  <span className="font-medium text-neutral-900 dark:text-foreground">
                    Pro $5/mo
                  </span>{" "}
                  -- 1,000 links/month, 10,000 events, unlimited analytics, 3
                  custom domains, API access
                </p>
                <p>
                  <span className="font-medium text-neutral-900 dark:text-foreground">
                    Ultra $15/mo
                  </span>{" "}
                  -- Unlimited everything, team collaboration, priority support
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-100 dark:border-border/50 px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-foreground sm:text-3xl">
            Ready to try iShortn?
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
            Join thousands of teams who have switched from {competitor.name}.
            Start for free -- no credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/auth/sign-up"
              className="inline-flex rounded-full bg-neutral-900 px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Get Started for Free
            </a>
            <a
              href="/#pricing"
              className="inline-flex rounded-full border border-neutral-200 dark:border-border px-7 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:border-neutral-300 dark:hover:border-border hover:text-neutral-900 dark:hover:text-foreground"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

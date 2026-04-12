import { IconCheck } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";

import { Paths } from "@/lib/constants/app";
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
    <main className="relative bg-zinc-950">
      <Header />

      {/* Hero */}
      <section className="bg-zinc-950 px-6 pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Comparison
          </p>
          <h1 className="mt-4 font-heading text-5xl font-extrabold tracking-tight text-zinc-50 leading-[1.05] md:text-6xl lg:text-[5.5rem]">
            {competitor.name}
            <br />
            vs iShortn
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
            {competitor.description}
          </p>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Features
          </p>
          <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
            Feature-by-feature comparison
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400">
            See how {competitor.name} and iShortn stack up across the features
            that matter most.
          </p>

          <div className="mt-12 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <div className="overflow-x-auto">
              <div className="grid min-w-[640px] grid-cols-3 border-b border-zinc-800 bg-zinc-900/30">
                <div className="px-6 py-5 font-heading text-sm font-medium text-zinc-50">
                  Feature
                </div>
                <div className="border-l border-zinc-800 px-6 py-5 font-heading text-sm font-medium text-zinc-50">
                  {competitor.name}
                </div>
                <div className="border-l border-zinc-800 px-6 py-5 font-heading text-sm font-medium text-blue-400">
                  iShortn
                </div>
              </div>

              {featureRows.map((row) => (
                <div
                  key={row.label}
                  className="grid min-w-[640px] grid-cols-3 border-t border-zinc-800"
                >
                  <div className="px-6 py-4 text-sm text-zinc-300">
                    {row.label}
                  </div>
                  <div className="border-l border-zinc-800 px-6 py-4 text-sm text-zinc-400">
                    {competitor[row.competitorKey]}
                  </div>
                  <div className="border-l border-zinc-800 bg-zinc-900/40 px-6 py-4 text-sm text-zinc-50">
                    {ishortn[row.competitorKey]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why teams switch */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Why switch
          </p>
          <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
            Why teams switch from {competitor.name}
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400">
            The top reasons teams move from {competitor.name} to iShortn.
          </p>

          <ul className="mt-12 grid gap-4 md:grid-cols-2">
            {competitor.whySwitch.map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
              >
                <IconCheck
                  size={18}
                  stroke={2}
                  className="mt-0.5 shrink-0 text-blue-400"
                />
                <span className="leading-relaxed text-zinc-300">{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing comparison */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Pricing
          </p>
          <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
            Pricing comparison
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {/* Competitor pricing */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 md:p-10">
              <h3 className="font-heading text-2xl font-bold text-zinc-50 md:text-3xl">
                {competitor.name}
              </h3>
              <p className="mt-2 text-sm text-zinc-500">{competitor.tagline}</p>
              <p className="mt-6 leading-relaxed text-zinc-400">
                {competitor.pricing}
              </p>
            </div>

            {/* iShortn pricing */}
            <div className="rounded-2xl border border-blue-500/40 bg-zinc-900/50 p-8 ring-1 ring-blue-500/20 md:p-10">
              <h3 className="font-heading text-2xl font-bold text-zinc-50 md:text-3xl">
                iShortn
              </h3>
              <p className="mt-2 text-sm text-zinc-500">
                Simple, powerful link shortening
              </p>
              <div className="mt-6 space-y-3 leading-relaxed text-zinc-400">
                <p>
                  <span className="font-medium text-zinc-50">Free</span> — 30
                  links/month, 1,000 events, 7-day analytics
                </p>
                <p>
                  <span className="font-medium text-zinc-50">Pro $5/mo</span> —
                  1,000 links/month, 10,000 events, unlimited analytics, 3
                  custom domains, API access
                </p>
                <p>
                  <span className="font-medium text-zinc-50">Ultra $15/mo</span>{" "}
                  — Unlimited everything, team collaboration, priority support
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-8 py-16 text-center md:px-16 md:py-20">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl lg:text-5xl">
              Ready to try iShortn?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-zinc-400">
              Join thousands of teams who have switched from {competitor.name}.
              Start for free — no credit card required.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={Paths.Login}
                className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
              >
                Get started free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-8 py-3.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-50"
              >
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

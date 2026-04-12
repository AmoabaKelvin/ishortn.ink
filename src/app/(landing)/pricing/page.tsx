import { IconCheck, IconMinus } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { Pricing } from "../_components/pricing";

import { Paths } from "@/lib/constants/app";

export const metadata: Metadata = {
  title: "Pricing - Free URL Shortener Plans | iShortn",
  description:
    "Simple, transparent pricing for iShortn URL shortener. Start free with 30 links per month. Upgrade for custom domains, API access, and unlimited links.",
  keywords: [
    "url shortener pricing",
    "free url shortener",
    "link shortener plans",
    "url shortener cost",
  ],
  openGraph: {
    title: "Pricing - Free URL Shortener Plans | iShortn",
    description:
      "Simple, transparent pricing for iShortn URL shortener. Start free with 30 links per month. Upgrade for custom domains, API access, and unlimited links.",
    type: "website",
  },
};

const comparisonFeatures = [
  {
    name: "Links per month",
    free: "30",
    pro: "1,000",
    ultra: "Unlimited",
  },
  {
    name: "Tracked events",
    free: "1,000",
    pro: "10,000",
    ultra: "Unlimited",
  },
  {
    name: "Analytics retention",
    free: "7 days",
    pro: "Unlimited",
    ultra: "Unlimited",
  },
  {
    name: "Custom domains",
    free: false,
    pro: "3",
    ultra: "Unlimited",
  },
  {
    name: "QR codes",
    free: true,
    pro: true,
    ultra: true,
  },
  {
    name: "Password protection",
    free: false,
    pro: true,
    ultra: true,
  },
  {
    name: "API access",
    free: false,
    pro: true,
    ultra: true,
  },
  {
    name: "Team collaboration",
    free: false,
    pro: false,
    ultra: true,
  },
  {
    name: "Priority support",
    free: false,
    pro: true,
    ultra: true,
  },
];

const faqs = [
  {
    question: "Can I try Pro features for free?",
    answer:
      "Yes, we offer a free trial period for all paid plans. You can explore every Pro and Ultra feature before committing to a subscription.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, you can cancel or downgrade at any time. No lock-in contracts. Your plan stays active until the end of the current billing period.",
  },
  {
    question: "What happens when I reach my link limit?",
    answer:
      "You won't be able to create new links until the next month or until you upgrade. Existing links continue to work and track clicks as normal.",
  },
  {
    question: "Do you offer annual billing?",
    answer:
      "Contact us for annual billing options with a discount. Reach out at support@ishortn.ink and we will set up a plan that works for you.",
  },
];

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "string") {
    return <span className="text-sm text-zinc-300">{value}</span>;
  }
  if (value) {
    return (
      <IconCheck size={18} className="mx-auto text-blue-400" stroke={2} />
    );
  }
  return <IconMinus size={18} className="mx-auto text-zinc-600" stroke={2} />;
}

export default function PricingPage() {
  return (
    <main className="relative bg-zinc-950">
      <Header />

      {/* Hero */}
      <section className="bg-zinc-950 px-6 pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Pricing
          </p>
          <h1 className="mt-4 font-heading text-5xl font-extrabold tracking-tight text-zinc-50 leading-[1.05] md:text-6xl lg:text-[5.5rem]">
            Simple pricing
            <br />
            for every team
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
            Start for free. Upgrade when you need custom domains, API access,
            or unlimited links. No surprises, no lock-in.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <Pricing />

      {/* Feature Comparison Table */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Compare plans
          </p>
          <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
            Every feature, side by side
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-400">
            A complete breakdown of what you get on each plan.
          </p>

          <div className="mt-12 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-6 py-5 font-heading text-sm font-medium text-zinc-50">
                      Feature
                    </th>
                    <th className="px-6 py-5 text-center font-heading text-sm font-medium text-zinc-50">
                      Free
                    </th>
                    <th className="px-6 py-5 text-center font-heading text-sm font-medium text-zinc-50">
                      Pro
                      <span className="ml-1 font-sans font-normal text-zinc-500">
                        $5/mo
                      </span>
                    </th>
                    <th className="px-6 py-5 text-center font-heading text-sm font-medium text-zinc-50">
                      Ultra
                      <span className="ml-1 font-sans font-normal text-zinc-500">
                        $15/mo
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature) => (
                    <tr key={feature.name} className="border-t border-zinc-800">
                      <td className="px-6 py-4 text-sm text-zinc-300">
                        {feature.name}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <CellValue value={feature.free} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <CellValue value={feature.pro} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <CellValue value={feature.ultra} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            FAQ
          </p>
          <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight text-zinc-50 md:text-5xl">
            Frequently asked questions
          </h2>

          <dl className="mt-12 grid gap-6 md:grid-cols-2">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8"
              >
                <dt className="font-heading text-xl font-bold text-zinc-50">
                  {faq.question}
                </dt>
                <dd className="mt-3 leading-relaxed text-zinc-400">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-zinc-950 px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-8 py-16 text-center md:px-16 md:py-20">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl lg:text-5xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-zinc-400">
              Join thousands of teams shortening and tracking links with
              iShortn. No credit card required.
            </p>
            <Link
              href={Paths.Login}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-500 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              Get started free
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

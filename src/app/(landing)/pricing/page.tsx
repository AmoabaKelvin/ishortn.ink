import type { Metadata } from "next";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { Pricing } from "../_components/pricing";

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
    return <span className="text-sm text-neutral-900 dark:text-foreground">{value}</span>;
  }
  if (value) {
    return (
      <svg
        className="mx-auto h-5 w-5 text-neutral-900 dark:text-foreground"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 12.75l6 6 9-13.5"
        />
      </svg>
    );
  }
  return (
    <svg
      className="mx-auto h-5 w-5 text-neutral-300 dark:text-neutral-600"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 12H6"
      />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <main className="relative bg-white dark:bg-card">
      <Header />

      {/* Hero */}
      <section className="px-6 pt-32 pb-12 md:pt-40 md:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Pricing
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-neutral-900 dark:text-foreground sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-base text-neutral-500 dark:text-neutral-400">
            Start for free. Upgrade when you need to.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <Pricing />

      {/* Feature Comparison Table */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center font-display text-2xl tracking-tight text-neutral-900 dark:text-foreground sm:text-3xl">
            Compare plans in detail
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-border">
                  <th className="py-4 pr-6 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-neutral-900 dark:text-foreground">
                    Free
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-neutral-900 dark:text-foreground">
                    Pro
                    <span className="ml-1 text-neutral-400 dark:text-neutral-500">$5/mo</span>
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-neutral-900 dark:text-foreground">
                    Ultra
                    <span className="ml-1 text-neutral-400 dark:text-neutral-500">$15/mo</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature) => (
                  <tr
                    key={feature.name}
                    className="border-b border-neutral-100 dark:border-border/50"
                  >
                    <td className="py-4 pr-6 text-sm text-neutral-700 dark:text-neutral-300">
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
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center font-display text-2xl tracking-tight text-neutral-900 dark:text-foreground sm:text-3xl">
            Frequently asked questions
          </h2>

          <dl className="space-y-8">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="text-base font-semibold text-neutral-900 dark:text-foreground">
                  {faq.question}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {faq.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Footer />
    </main>
  );
}

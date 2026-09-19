import { IconTagFilled } from "@tabler/icons-react";

import { JsonLd } from "@/components/seo/json-ld";
import {
  createBreadcrumbSchema,
  createFaqSchema,
  softwareApplicationSchema,
} from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../_components/cta";
import { Faq } from "../_components/faq";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { Pricing } from "../_components/pricing";
import { Eyebrow, h1Class, leadClass, Section } from "../_components/site-primitives";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — iShortn",
  description:
    "Start free forever. Upgrade when you're ready. Cancel in one click. Pro and Ultra plans for solo makers and growing teams.",
  keywords: [
    "url shortener pricing",
    "free url shortener",
    "link shortener plans",
    "url shortener cost",
  ],
  openGraph: {
    title: "Pricing — iShortn",
    description:
      "Start free forever. Upgrade when you're ready. Cancel in one click. Pro and Ultra plans for solo makers and growing teams.",
    type: "website",
  },
};

const pricingFaqs = [
  {
    q: "What counts as a tracked event?",
    a: "A single click or QR scan on one of your short links. Pro includes 10,000 events per month; Ultra is unlimited.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel or downgrade in one click. Your plan stays active until the end of the current billing period, and your links keep working.",
  },
  {
    q: "What happens when I hit my monthly link limit?",
    a: "Existing links keep working and keep collecting clicks. You won't be able to create new ones until the next month rolls over or you upgrade.",
  },
  {
    q: "Do I get a custom domain on the free plan?",
    a: "Custom domains are on Pro (up to 3) and Ultra (unlimited). Free uses ishortn.ink/your-slug.",
  },
  {
    q: "Is the API available on every plan?",
    a: "The REST API is available on Pro and Ultra. Free is for interactive use through the dashboard.",
  },
];

export default function PricingPage() {
  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Pricing", url: "https://ishortn.ink/pricing" },
        ])}
      />
      <JsonLd data={softwareApplicationSchema} />
      <JsonLd data={createFaqSchema(pricingFaqs.map((f) => ({ question: f.q, answer: f.a })))} />
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconTagFilled aria-hidden="true" />}>Pricing</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>Plans that grow with your links</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Start free forever. Upgrade when you need more, and cancel in one click.
          </p>
        </div>
      </Section>

      <Pricing />

      <Faq faqs={pricingFaqs} />

      <CTA />
      <Footer />
    </main>
  );
}

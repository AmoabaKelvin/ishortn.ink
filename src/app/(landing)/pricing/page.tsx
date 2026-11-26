import { IconTagFilled } from "@tabler/icons-react";

import { JsonLd } from "@/components/seo/json-ld";
import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { getActivePromo } from "@/lib/billing/promo";
import { linkOwnershipFaq } from "@/lib/copy/link-ownership";
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
import { Testimonial } from "../_components/testimonial";

import type { Metadata } from "next";

// Static, but re-rendered every 5 minutes so a time-boxed promo appears and disappears within
// minutes of its window without making the page render per request.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Pricing: Free, Pro $8 and Ultra $15",
  description:
    "Start free forever. Upgrade when you're ready. Cancel in one click. Pro and Ultra plans for solo makers and growing teams.",
  keywords: [
    "url shortener pricing",
    "free url shortener",
    "link shortener plans",
    "url shortener cost",
  ],
  openGraph: {
    title: "Pricing: Free, Pro $8 and Ultra $15 — iShortn",
    description:
      "Start free forever. Upgrade when you're ready. Cancel in one click. Pro and Ultra plans for solo makers and growing teams.",
    type: "website",
  },
};

const pricingFaqs = [
  {
    q: "What counts as a tracked event?",
    a: "A single click or QR scan on one of your short links, or a view of one of your bio pages. Free includes 1,000 events per month, Pro 10,000, and Ultra is unlimited. Over the limit your links keep redirecting, but new events aren't recorded until the next month.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel or downgrade in one click. Your plan stays active until the end of the current billing period, and your links keep working.",
  },
  {
    q: "Can I switch between monthly and annual?",
    a: "Yes, from the billing settings in your dashboard. Switching to annual charges the yearly price right away, minus credit for the unused part of your current month. Switching to monthly takes effect right away too, and the unused time on your annual plan is credited toward your next invoices.",
  },
  {
    q: "What happens when I hit my monthly link limit?",
    a: "Existing links keep working and keep collecting clicks. You won't be able to create new ones until the next month rolls over or you upgrade.",
  },
  {
    q: "Do I get a custom domain on the free plan?",
    a: "Custom domains are on Pro (up to 3) and Ultra (unlimited). Free uses isht.app/your-slug.",
  },
  {
    q: "Do QR codes on the Free plan expire?",
    a: `No. Free includes ${FREE_QR_CODE_LIMIT} dynamic QR codes. You can edit where they point at any time, they never expire, and scanning them shows no ads. Pro and Ultra add branded QR codes.`,
  },
  { q: linkOwnershipFaq.question, a: linkOwnershipFaq.answer },
  {
    q: "Can my link-in-bio page use my own domain?",
    a: `Yes, from Pro. Pro includes ${PLAN_CAPS.pro.bioPageLimit} bio pages on your custom domain with no iShortn branding, and Ultra has unlimited pages. Free includes one page on isht.app with up to ${PLAN_CAPS.free.bioLinkBlocksPerPageLimit} link blocks.`,
  },
  {
    q: "Is the API available on every plan?",
    a: "The REST API is available on Pro and Ultra. Free is for interactive use through the dashboard and can't create API keys. If a paid plan ends, its API keys keep working on Free limits for 7 days, then requests return 403 until the account upgrades.",
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

      <Pricing showHeading={false} promo={getActivePromo()} />

      <Testimonial />

      <Faq faqs={pricingFaqs} />

      <CTA />
      <Footer />
    </main>
  );
}

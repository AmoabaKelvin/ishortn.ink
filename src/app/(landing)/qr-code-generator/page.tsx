import {
  IconChartAreaLineFilled,
  IconCheck,
  IconPencilFilled,
  IconClockFilled,
  IconQrcode,
  IconShieldCheckFilled,
  IconSparklesFilled,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { JsonLd } from "@/components/seo/json-ld";
import { FREE_QR_CODE_LIMIT as FREE_DYNAMIC_QR_CODES } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
import { livePostLinks } from "@/lib/seo/related-links";
import {
  createBreadcrumbSchema,
  createFaqSchema,
  createWebApplicationSchema,
} from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../_components/cta";
import { Faq } from "../_components/faq";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { RelatedReading } from "../_components/related-reading";
import {
  bodyClass,
  ButtonLink,
  cardClass,
  Eyebrow,
  h1Class,
  h3Class,
  IconPlate,
  leadClass,
  Section,
  SectionHeading,
} from "../_components/site-primitives";
import { QrGenerator } from "./qr-generator";

import type { Metadata } from "next";
import type { ReactNode } from "react";

const description =
  "Create a free QR code in your browser and download it as a PNG or SVG, no sign-up needed. Need a code you can edit after printing and track? iShortn Free includes 5 dynamic QR codes that never expire.";

// Hourly, so a related blog post scheduled for a future date shows up on that day.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Free QR Code Generator That Doesn't Expire",
  description,
  keywords: [
    "free qr code generator",
    "qr code generator that doesn't expire",
    "free qr code generator no expiration",
    "dynamic qr code",
    "qr code with analytics",
    "free svg qr code generator",
  ],
  alternates: { canonical: "/qr-code-generator" },
  openGraph: {
    title: "Free QR Code Generator That Doesn't Expire — iShortn",
    description,
    type: "website",
    url: "/qr-code-generator",
  },
};

const free = PLAN_CAPS.free;

const comparison: { title: string; summary: string; points: string[] }[] = [
  {
    title: "Static QR code",
    summary: "What the generator above makes.",
    points: [
      "The URL is encoded directly in the pattern",
      "Works for as long as the URL works",
      "Downloads as a PNG or a vector SVG",
      "Can't be changed once printed",
      "No scan counts or analytics",
    ],
  },
  {
    title: "Dynamic QR code",
    summary: "What you get with a free iShortn account.",
    points: [
      "Points to a short link you control",
      "Change the destination anytime, even after printing",
      "See scans by day, country, and device",
      "Pause it or reset its stats from the dashboard",
    ],
  },
];

const freeIncludes: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: `${FREE_DYNAMIC_QR_CODES} dynamic QR codes`,
    body: "Create up to five codes on the Free plan. No credit card required.",
    icon: <IconQrcode aria-hidden="true" />,
  },
  {
    title: "Never expire",
    body: "Your codes keep working. There is no trial that runs out and switches them off.",
    icon: <IconClockFilled aria-hidden="true" />,
  },
  {
    title: "Edit the destination",
    body: "Point a printed code at a new page whenever you need to. The code itself stays the same.",
    icon: <IconPencilFilled aria-hidden="true" />,
  },
  {
    title: "Scan analytics",
    body: `See where and when people scan, with a ${free.analyticsRangeLimitDays}-day analytics window and ${(free.eventsLimit ?? 0).toLocaleString()} tracked clicks a month.`,
    icon: <IconChartAreaLineFilled aria-hidden="true" />,
  },
  {
    title: "No ads",
    body: "People who scan go straight to your page, with no interstitial ad in between.",
    icon: <IconShieldCheckFilled aria-hidden="true" />,
  },
];

const qrFaqs = [
  {
    q: "Does the free QR code expire?",
    a: "No. A static code from this page encodes your URL directly, so it works for as long as that URL does. Dynamic codes on the iShortn Free plan never expire either.",
  },
  {
    q: "Can I change the link after printing?",
    a: "Not with a static code: the link is part of the pattern. A dynamic code points to a short link instead, so you can change the destination from your dashboard and the printed code keeps working.",
  },
  {
    q: "How do I track QR code scans?",
    a: `Create a dynamic code in your iShortn dashboard. Every scan is recorded with its date, country, and device. Free includes a ${free.analyticsRangeLimitDays}-day analytics window and ${(free.eventsLimit ?? 0).toLocaleString()} tracked clicks a month.`,
  },
  {
    q: "Can I download the QR code as an SVG?",
    a: "Yes. Codes from this page download as a PNG or an SVG. The PNG is 1024 pixels square, which suits screens and everyday print. The SVG is a vector file that stays sharp at any size, so use it for signs, banners, stickers, engraving, or when a printer asks for a vector file.",
  },
  {
    q: "Is anything stored when I use this generator?",
    a: "No. The code and both downloads are made in your browser. The URL you type is never sent to our servers, and you don't need an account.",
  },
  {
    q: "Do dynamic QR codes count toward my link limit?",
    a: `Yes. Each dynamic code uses a short link, which counts toward the Free plan's ${free.linksLimit} links per month.`,
  },
];

export default function QrCodeGeneratorPage() {
  return (
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "QR Code Generator", url: "https://ishortn.ink/qr-code-generator" },
        ])}
      />
      <JsonLd data={createFaqSchema(qrFaqs.map((f) => ({ question: f.q, answer: f.a })))} />
      <JsonLd
        data={createWebApplicationSchema({
          name: "QR Code Generator",
          url: "https://ishortn.ink/qr-code-generator",
          description,
        })}
      />
      <Header />

      {/* Hero + generator */}
      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>QR code generator</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>
            Free QR code generator that doesn&apos;t expire
          </h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Paste a link and download a QR code in seconds. No account, no ads, no expiry date.
          </p>
        </div>
        <div className="mt-12 sm:mt-14">
          <QrGenerator />
          <p className="mx-auto mt-4 max-w-4xl text-pretty text-center text-sm text-neutral-600">
            Want people to message you instead? Make a{" "}
            <Link
              href="/whatsapp-link-generator"
              className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
            >
              WhatsApp QR code
            </Link>{" "}
            with your message already typed in.
          </p>
        </div>
      </Section>

      {/* Static vs dynamic */}
      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconQrcode aria-hidden="true" />}>Static vs dynamic</Eyebrow>}
          title="Two kinds of QR code"
          subtitle="Both never expire. Only one can be edited and tracked after it's printed."
        />
        <div className="mx-auto mt-14 grid max-w-4xl gap-4 md:grid-cols-2">
          {comparison.map((item) => (
            <div key={item.title} className={cn(cardClass, "p-6 sm:p-8")}>
              <h3 className={h3Class}>{item.title}</h3>
              <p className={cn(bodyClass, "mt-2 sm:text-sm")}>{item.summary}</p>
              <ul className="mt-6 space-y-3">
                {item.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-base text-neutral-700 sm:text-sm"
                  >
                    <IconCheck
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-neutral-900"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Free plan */}
      <Section>
        <SectionHeading
          eyebrow={<Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>Free plan</Eyebrow>}
          title="Dynamic QR codes, free"
          subtitle="Everything you need to put a code on a menu, flyer, or package and know it's working."
          actions={
            <>
              <ButtonLink variant="secondary" href="/blog/free-qr-code-generator-guide">
                Read the QR code guide
              </ButtonLink>
              <ButtonLink variant="soft" href="/pricing">
                View pricing
              </ButtonLink>
              <ButtonLink variant="soft" href="/utm-builder">
                Build a UTM link
              </ButtonLink>
            </>
          }
        />
        {/* 3 + 2 on desktop so five cards fill the grid */}
        <dl className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {freeIncludes.map((item, i) => (
            <div
              key={item.title}
              className={cn(
                cardClass,
                "p-6 sm:p-8 lg:col-span-2",
                i >= 3 && "lg:col-span-3",
                i === 4 && "sm:col-span-2",
              )}
            >
              <IconPlate>{item.icon}</IconPlate>
              <dt className={cn(h3Class, "mt-6")}>{item.title}</dt>
              <dd className={cn(bodyClass, "mt-2 sm:text-sm")}>{item.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Faq faqs={qrFaqs} />

      <RelatedReading
        links={livePostLinks(["how-to-track-qr-code-scans", "qr-code-stopped-working"])}
      />

      <CTA />
      <Footer />
    </main>
  );
}

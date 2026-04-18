import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { landingPageCopy } from "@/lib/copy/landing-page";
import {
  createFaqSchema,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo/structured-data";

import { CTA } from "./_components/cta";
import { DashboardPreview } from "./_components/dashboard-preview";
import { Faq } from "./_components/faq";
import { Features } from "./_components/features";
import { Footer } from "./_components/footer";
import { Header } from "./_components/header";
import { Hero } from "./_components/hero";
import { Pricing } from "./_components/pricing";
import { QRSection } from "./_components/qr-section";
import { Testimonials } from "./_components/testimonials";

export const metadata: Metadata = {
  title: {
    absolute:
      "iShortn — Links, made lovely. Free URL shortener with analytics",
  },
  description:
    "Shorten URLs for free with iShortn. Create branded short links, track clicks and conversions, generate QR codes, and use custom domains. The best free URL shortener with powerful analytics.",
  keywords: [
    "url shortener",
    "free url shortener",
    "link shortener",
    "short url",
    "custom short links",
    "link analytics",
    "click tracking",
    "qr code generator",
    "branded links",
    "url shortener free",
  ],
  openGraph: {
    title:
      "iShortn — Links, made lovely. Free URL shortener with analytics",
    description:
      "Shorten URLs for free with iShortn. Create branded short links, track clicks and conversions, generate QR codes, and use custom domains.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "iShortn — Links, made lovely. Free URL shortener with analytics",
    description:
      "Shorten URLs for free with iShortn. Create branded short links, track clicks and conversions, generate QR codes, and use custom domains.",
  },
};

export default function HomePage() {
  return (
    <main style={{ background: "var(--warm-bg)", color: "var(--warm-ink)" }}>
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareApplicationSchema} />
      <JsonLd data={createFaqSchema(landingPageCopy.faq)} />
      <JsonLd data={websiteSchema} />
      <Header />
      <Hero />
      <DashboardPreview />
      <Features />
      <QRSection />
      <Pricing />
      <Testimonials />
      <Faq />
      <CTA />
      <Footer />
    </main>
  );
}

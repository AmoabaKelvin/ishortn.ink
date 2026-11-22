import { JsonLd } from "@/components/seo/json-ld";
import { landingPageCopy } from "@/lib/copy/landing-page";
import { pageCards } from "@/lib/seo/og-cards";
import { ROOT_OG_IMAGE_URL, socialImages } from "@/lib/seo/og-image";
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
import { HowItWorks } from "./_components/how-it-works";
import { Pricing } from "./_components/pricing";
import { QRSection } from "./_components/qr-section";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "iShortn: Free URL Shortener with Analytics and QR Codes",
  },
  description:
    "Shorten URLs for free with iShortn. Create branded short links, track clicks and engagement, generate QR codes, and use custom domains.",
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
    title: "iShortn: Free URL Shortener with Analytics and QR Codes",
    description:
      "Shorten URLs for free with iShortn. Create branded short links, track clicks and engagement, generate QR codes, and use custom domains.",
    type: "website",
    images: socialImages(ROOT_OG_IMAGE_URL, pageCards.home.alt),
  },
  twitter: {
    card: "summary_large_image",
    title: "iShortn — The better way to share your links. Free URL shortener with analytics",
    description:
      "Shorten URLs for free with iShortn. Create branded short links, track clicks and engagement, generate QR codes, and use custom domains.",
    images: socialImages(ROOT_OG_IMAGE_URL, pageCards.home.alt),
  },
};

export default function HomePage() {
  return (
    <main>
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareApplicationSchema} />
      <JsonLd data={createFaqSchema(landingPageCopy.faq)} />
      <JsonLd data={websiteSchema} />
      <Header />
      <Hero />
      <HowItWorks />
      <Features />
      <DashboardPreview />
      <QRSection />
      <Pricing />
      <Faq />
      <CTA />
      <Footer />
    </main>
  );
}

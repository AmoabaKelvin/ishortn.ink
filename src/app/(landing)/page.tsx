import { JsonLd } from "@/components/seo/json-ld";
import { getActivePromo } from "@/lib/billing/promo";
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
import { FreeTools, Guides } from "./_components/resources";
import { Testimonial } from "./_components/testimonial";

import type { Metadata } from "next";

// Every 5 minutes, so a time-boxed promo in the pricing section appears and disappears close to its
// window edges, and a curated guide scheduled for a future date shows up on that day.
export const revalidate = 300;

export const metadata: Metadata = {
  title: {
    absolute: "Free URL Shortener with Click Tracking & Analytics | iShortn",
  },
  description:
    "Shorten links for free and track every click by country, city, device and referrer. Make dynamic QR codes and use your own domain on Pro. No card needed.",
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
    "click tracking free",
    "url shortener with analytics",
    "link tracker",
  ],
  openGraph: {
    title: "Free URL Shortener with Click Tracking & Analytics | iShortn",
    description:
      "Shorten links for free and track every click by country, city, device and referrer. Make dynamic QR codes and use your own domain on Pro. No card needed.",
    type: "website",
    images: socialImages(ROOT_OG_IMAGE_URL, pageCards.home.alt),
  },
  twitter: {
    card: "summary_large_image",
    title: "Free URL Shortener with Click Tracking & Analytics | iShortn",
    description:
      "Shorten links for free and track every click by country, city, device and referrer. Make dynamic QR codes and use your own domain on Pro. No card needed.",
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
      <Testimonial />
      <Pricing promo={getActivePromo()} />
      <FreeTools />
      <Guides />
      <Faq />
      <CTA />
      <Footer />
    </main>
  );
}

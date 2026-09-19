import { IconSparklesFilled } from "@tabler/icons-react";

import { JsonLd } from "@/components/seo/json-ld";
import { createBreadcrumbSchema, softwareApplicationSchema } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { CTA } from "../_components/cta";
import { DashboardPreview } from "../_components/dashboard-preview";
import { Features } from "../_components/features";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { QRSection } from "../_components/qr-section";
import { Eyebrow, h1Class, leadClass, Section } from "../_components/site-primitives";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features — iShortn",
  description:
    "Everything inside iShortn: real-time analytics, custom domains, QR codes, password-protected links, bulk shorten, and a simple API.",
  keywords: [
    "url shortener features",
    "link analytics",
    "custom domains",
    "qr code generator",
    "link management features",
  ],
  openGraph: {
    title: "Features — iShortn",
    description:
      "Everything inside iShortn: real-time analytics, custom domains, QR codes, password-protected links, bulk shorten, and a simple API.",
    type: "website",
  },
};

export default function FeaturesPage() {
  return (
    <main>
      <JsonLd data={softwareApplicationSchema} />
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Features", url: "https://ishortn.ink/features" },
        ])}
      />
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconSparklesFilled aria-hidden="true" />}>Features</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>
            Everything you need to manage your links
          </h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Real-time analytics, custom domains, branded QR codes, and bulk shortening in one place.
          </p>
        </div>
      </Section>

      <Features />
      <DashboardPreview />
      <QRSection />
      <CTA />
      <Footer />
    </main>
  );
}

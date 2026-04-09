import { JsonLd } from "@/components/seo/json-ld";
import { landingPageCopy } from "@/lib/copy/landing-page";
import { organizationSchema, softwareApplicationSchema, createFaqSchema, websiteSchema } from "@/lib/seo/structured-data";

import { CTA } from "./_components/cta";
import { Faq } from "./_components/faq";
import { Features } from "./_components/features";
import { Footer } from "./_components/footer";
import { Header } from "./_components/header";
import { Hero } from "./_components/hero";
import { Pricing } from "./_components/pricing";
import { Testimonials } from "./_components/testimonials";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute:
      "Free URL Shortener with Analytics | iShortn - Custom Short Links",
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
      "Free URL Shortener with Analytics | iShortn - Custom Short Links",
    description:
      "Shorten URLs for free with iShortn. Create branded short links, track clicks and conversions, generate QR codes, and use custom domains. The best free URL shortener with powerful analytics.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Free URL Shortener with Analytics | iShortn - Custom Short Links",
    description:
      "Shorten URLs for free with iShortn. Create branded short links, track clicks and conversions, generate QR codes, and use custom domains. The best free URL shortener with powerful analytics.",
  },
};

const HomePage = () => {
  return (
    <main className="relative bg-white dark:bg-card">
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareApplicationSchema} />
      <JsonLd data={createFaqSchema(landingPageCopy.faq)} />
      <JsonLd data={websiteSchema} />
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <Testimonials />

      {/* FAQ Section */}
      <section id="faq" className="landing-section">
        <div className="landing-container">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            FAQ
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-neutral-900 dark:text-foreground sm:text-4xl">
            Common questions
          </h2>
          <div className="mt-12">
            <Faq faqs={landingPageCopy.faq} />
          </div>
        </div>
      </section>

      <CTA />
      <Footer />
    </main>
  );
};

export default HomePage;

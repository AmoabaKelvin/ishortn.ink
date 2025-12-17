import { HelpCircle } from "lucide-react";

import { landingPageCopy } from "@/lib/copy/landing-page";

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
    absolute: "iShortn - Short links. Big impact.",
  },
  description:
    "Transform lengthy URLs into powerful branded links. Track clicks, understand your audience, and grow with actionable insights. Free URL shortener with analytics.",
  openGraph: {
    title: "iShortn - Short links. Big impact.",
    description:
      "Transform lengthy URLs into powerful branded links. Track clicks, understand your audience, and grow with actionable insights.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iShortn - Short links. Big impact.",
    description:
      "Transform lengthy URLs into powerful branded links. Track clicks, understand your audience, and grow with actionable insights.",
  },
};

const HomePage = () => {
  return (
    <main className="relative">
      <Header />

      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <Features />

      {/* Pricing Section */}
      <Pricing />

      {/* Testimonials Section */}
      <Testimonials />

      {/* FAQ Section */}
      <section id="faq" className="landing-section relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-neutral-50/30 to-white" />
        <div className="noise-overlay" />

        <div className="landing-container relative z-10">
          {/* Section Header */}
          <div className="mb-16 text-center">
            <div className="landing-badge mx-auto mb-6">
              <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
              <span>Got Questions?</span>
            </div>
            <h2 className="font-display text-4xl tracking-tight text-neutral-900 sm:text-5xl">
              Frequently asked questions
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-600">
              Everything you need to know about iShortn. Can&apos;t find the answer
              you&apos;re looking for? Reach out to our support team.
            </p>
          </div>

          <Faq faqs={landingPageCopy.faq} />

          {/* Contact CTA */}
          <div className="mx-auto mt-16 max-w-xl rounded-3xl border border-neutral-200/60 bg-gradient-to-br from-neutral-50 to-white p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-white">
              <HelpCircle className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-900">
              Still have questions?
            </h3>
            <p className="mt-2 text-neutral-600">
              Can&apos;t find what you&apos;re looking for? Our team is here to help.
            </p>
            <a
              href="mailto:support@ishortn.ink"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-neutral-800 hover:shadow-lg hover:shadow-neutral-900/20"
            >
              Contact Support
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTA />

      {/* Footer */}
      <Footer />
    </main>
  );
};

export default HomePage;

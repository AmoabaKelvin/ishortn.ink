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
    <main className="relative bg-white">
      <Header />
      <Hero />
      <Features />
      <Pricing />
      <Testimonials />

      {/* FAQ Section */}
      <section id="faq" className="landing-section">
        <div className="landing-container">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            FAQ
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-neutral-900 sm:text-4xl">
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

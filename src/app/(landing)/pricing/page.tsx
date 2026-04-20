import type { Metadata } from "next";

import { CTA } from "../_components/cta";
import { Faq } from "../_components/faq";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { Pricing } from "../_components/pricing";
import { Icon } from "../_components/warm-primitives";

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
    <main style={{ background: "var(--warm-bg)", color: "var(--warm-ink)" }}>
      <Header />

      <section className="warm-subhero">
        <div className="warm-container">
          <div className="warm-eyebrow" style={{ marginBottom: 24 }}>
            <Icon.Heart
              style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
            />
            Pricing
          </div>
          <h1
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(44px, 11vw, 104px)" }}
          >
            Fair prices,
            <br />
            <em style={{ color: "var(--warm-accent)", fontStyle: "italic" }}>
              no surprises.
            </em>
          </h1>
          <p
            style={{
              fontSize: 19,
              color: "var(--warm-mute)",
              marginTop: 24,
              lineHeight: 1.6,
              maxWidth: 620,
            }}
          >
            Start free forever. Upgrade when you need more. Cancel in one click
            — no lock-in, no nagging emails.
          </p>
        </div>
      </section>

      <Pricing />

      <Faq faqs={pricingFaqs} />

      <CTA />
      <Footer />
    </main>
  );
}

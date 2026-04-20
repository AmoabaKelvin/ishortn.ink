import type { Metadata } from "next";

import { CTA } from "../_components/cta";
import { DashboardPreview } from "../_components/dashboard-preview";
import { Features } from "../_components/features";
import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { QRSection } from "../_components/qr-section";
import { Icon } from "../_components/warm-primitives";

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
    <main style={{ background: "var(--warm-bg)", color: "var(--warm-ink)" }}>
      <Header />

      <section className="warm-subhero">
        <div className="warm-container">
          <div className="warm-eyebrow" style={{ marginBottom: 24 }}>
            <Icon.Sparkle
              style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
            />
            Features
          </div>
          <h1
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(44px, 11vw, 104px)", maxWidth: 980 }}
          >
            Everything inside,
            <br />
            <em style={{ color: "var(--warm-accent)", fontStyle: "italic" }}>
              none of the clutter.
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
            Every feature iShortn ships — from real-time analytics to branded
            QR codes and bulk CSV shortening. Made for creators and small teams
            who want tools that get out of the way.
          </p>
        </div>
      </section>

      <Features />
      <DashboardPreview />
      <QRSection />
      <CTA />
      <Footer />
    </main>
  );
}

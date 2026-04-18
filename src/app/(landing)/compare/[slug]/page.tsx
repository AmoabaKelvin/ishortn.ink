import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "next-view-transitions";

import { Paths } from "@/lib/constants/app";
import { competitors, type Competitor } from "@/lib/seo/competitors";

import { CTA } from "../../_components/cta";
import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";
import { Icon } from "../../_components/warm-primitives";

export function generateStaticParams() {
  return Object.values(competitors).map((c) => ({ slug: c.slug }));
}

function getCompetitor(slug: string): Competitor | undefined {
  return Object.values(competitors).find((c) => c.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) return {};

  const title = `${competitor.name} vs iShortn — a warmer URL shortener`;
  const description = `Compare ${competitor.name} and iShortn side by side. See features, pricing, and why creators and small teams pick iShortn.`;

  return {
    title,
    description,
    keywords: [
      `${competitor.name.toLowerCase()} alternative`,
      `${competitor.name.toLowerCase()} vs ishortn`,
      `${competitor.slug} alternative`,
      "url shortener comparison",
      "best url shortener",
      "link shortener alternative",
    ],
    openGraph: { title, description, type: "website" },
  };
}

const ishortn = {
  freeLinks: "30/month on Free, 1,000 on Pro, unlimited on Ultra",
  freeAnalytics: "7 days on Free, unlimited on Pro and Ultra",
  customDomains: "3 on Pro, unlimited on Ultra",
  qrCodes: "All plans — branded + dynamic on Pro and Ultra",
  apiAccess: "Pro and Ultra",
  teamFeatures: "Ultra plan",
  passwordProtection: "All plans",
  pricing: "Free forever, Pro $5/mo, Ultra $15/mo",
};

type FeatureRow = {
  label: string;
  competitorKey: keyof typeof ishortn;
};

const featureRows: FeatureRow[] = [
  { label: "Free links", competitorKey: "freeLinks" },
  { label: "Analytics", competitorKey: "freeAnalytics" },
  { label: "Custom domains", competitorKey: "customDomains" },
  { label: "QR codes", competitorKey: "qrCodes" },
  { label: "API access", competitorKey: "apiAccess" },
  { label: "Team features", competitorKey: "teamFeatures" },
  { label: "Password protection", competitorKey: "passwordProtection" },
  { label: "Pricing", competitorKey: "pricing" },
];

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) return notFound();

  return (
    <main style={{ background: "var(--warm-bg)", color: "var(--warm-ink)" }}>
      <Header />

      <section style={{ padding: "120px 0 48px" }}>
        <div className="warm-container">
          <div className="warm-eyebrow" style={{ marginBottom: 24 }}>
            <Icon.Sparkle
              style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
            />
            Comparison
          </div>
          <h1
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(54px, 9vw, 104px)" }}
          >
            {competitor.name}
            <br />
            <em style={{ fontStyle: "italic", color: "var(--warm-accent)" }}>
              vs iShortn.
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
            {competitor.description}
          </p>
        </div>
      </section>

      <section className="warm-section warm-section-paper">
        <div className="warm-container">
          <div className="warm-eyebrow" style={{ marginBottom: 16 }}>
            <Icon.Chart
              style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
            />
            Features
          </div>
          <h2
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(40px, 6vw, 60px)" }}
          >
            Feature-by-feature
            <br />
            <em style={{ fontStyle: "italic" }}>side by side.</em>
          </h2>

          <div
            className="warm-card"
            style={{
              marginTop: 40,
              overflow: "hidden",
              background: "var(--warm-paper-2)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(200px, 1fr))",
                  borderBottom: "1px solid var(--warm-line)",
                  background: "var(--warm-paper)",
                }}
              >
                <div
                  style={{
                    padding: "18px 22px",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--warm-ink)",
                  }}
                >
                  Feature
                </div>
                <div
                  style={{
                    padding: "18px 22px",
                    borderLeft: "1px solid var(--warm-line-soft)",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {competitor.name}
                </div>
                <div
                  style={{
                    padding: "18px 22px",
                    borderLeft: "1px solid var(--warm-line-soft)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--warm-accent)",
                  }}
                >
                  iShortn
                </div>
              </div>

              {featureRows.map((row, i) => (
                <div
                  key={row.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(200px, 1fr))",
                    borderTop:
                      i === 0 ? "none" : "1px solid var(--warm-line-soft)",
                  }}
                >
                  <div
                    style={{
                      padding: "16px 22px",
                      fontSize: 14,
                      color: "var(--warm-ink-soft)",
                    }}
                  >
                    {row.label}
                  </div>
                  <div
                    style={{
                      padding: "16px 22px",
                      borderLeft: "1px solid var(--warm-line-soft)",
                      fontSize: 14,
                      color: "var(--warm-mute)",
                    }}
                  >
                    {competitor[row.competitorKey]}
                  </div>
                  <div
                    style={{
                      padding: "16px 22px",
                      borderLeft: "1px solid var(--warm-line-soft)",
                      background: "var(--warm-paper)",
                      fontSize: 14,
                      color: "var(--warm-ink)",
                    }}
                  >
                    {ishortn[row.competitorKey]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="warm-section">
        <div className="warm-container">
          <div className="warm-eyebrow" style={{ marginBottom: 16 }}>
            <Icon.Heart
              style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
            />
            Why switch
          </div>
          <h2
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(40px, 6vw, 60px)" }}
          >
            Why teams leave
            <br />
            <em style={{ fontStyle: "italic" }}>{competitor.name}.</em>
          </h2>

          <ul
            className="warm-switch-grid"
            style={{
              marginTop: 40,
              display: "grid",
              gap: 12,
              padding: 0,
              listStyle: "none",
            }}
          >
            {competitor.whySwitch.map((reason) => (
              <li
                key={reason}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  background: "var(--warm-paper)",
                  border: "1px solid var(--warm-line)",
                  borderRadius: 20,
                  padding: "20px 24px",
                }}
              >
                <Icon.Check
                  style={{
                    width: 16,
                    height: 16,
                    color: "var(--warm-accent)",
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                />
                <span
                  style={{
                    color: "var(--warm-ink-soft)",
                    lineHeight: 1.6,
                    fontSize: 15,
                  }}
                >
                  {reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="warm-section warm-section-paper">
        <div className="warm-container">
          <div className="warm-eyebrow" style={{ marginBottom: 16 }}>
            <Icon.Sparkle
              style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
            />
            Pricing
          </div>
          <h2
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(40px, 6vw, 60px)" }}
          >
            Pricing,
            <br />
            <em style={{ fontStyle: "italic" }}>plain and simple.</em>
          </h2>

          <div
            className="warm-compare-pricing"
            style={{
              marginTop: 40,
              display: "grid",
              gap: 20,
            }}
          >
            <div
              style={{
                background: "var(--warm-paper)",
                border: "1px solid var(--warm-line)",
                borderRadius: 24,
                padding: "32px 32px",
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-warm-display)",
                  fontSize: 28,
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                {competitor.name}
              </h3>
              <p
                style={{
                  marginTop: 8,
                  color: "var(--warm-mute)",
                  fontSize: 13,
                }}
              >
                {competitor.tagline}
              </p>
              <p
                style={{
                  marginTop: 20,
                  color: "var(--warm-ink-soft)",
                  lineHeight: 1.6,
                  fontSize: 15,
                }}
              >
                {competitor.pricing}
              </p>
            </div>

            <div
              style={{
                background: "var(--warm-ink)",
                color: "var(--warm-paper)",
                border: "1px solid var(--warm-ink)",
                borderRadius: 24,
                padding: "32px 32px",
              }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-warm-display)",
                  fontSize: 28,
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                iShortn
              </h3>
              <p
                style={{
                  marginTop: 8,
                  opacity: 0.7,
                  fontSize: 13,
                }}
              >
                Simple, warm, and gets out of the way.
              </p>
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  fontSize: 15,
                  lineHeight: 1.55,
                  opacity: 0.85,
                }}
              >
                <p style={{ margin: 0 }}>
                  <strong style={{ color: "var(--warm-paper)" }}>Free</strong> —
                  30 links/month, 1,000 tracked events, 7-day analytics.
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: "var(--warm-paper)" }}>Pro $5/mo</strong>{" "}
                  — 1,000 links/month, 10,000 tracked events, unlimited
                  analytics history, 3 custom domains, branded + dynamic QR
                  codes, REST API.
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: "var(--warm-paper)" }}>Ultra $15/mo</strong>{" "}
                  — everything in Pro plus unlimited links and events,
                  unlimited custom domains, team workspaces, resource transfer.
                </p>
              </div>
              <Link
                href={Paths.Signup}
                className="warm-btn warm-btn-accent"
                style={{ marginTop: 28 }}
              >
                Start free <Icon.Arrow />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <CTA />
      <Footer />
      <style>{`
        .warm-switch-grid { grid-template-columns: 1fr; }
        .warm-compare-pricing { grid-template-columns: 1fr; }
        @media (min-width: 800px) {
          .warm-switch-grid { grid-template-columns: repeat(2, 1fr); }
          .warm-compare-pricing { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </main>
  );
}

import { PLAN_CAPS } from "@/lib/billing/plans";
import { PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import { Icon } from "./warm-primitives";

const fmt = (n: number) => n.toLocaleString();
const free = PLAN_CAPS.free;
const pro = PLAN_CAPS.pro;

const buildPlans = (_annual: boolean) =>
  [
    {
      name: "Free",
      price: PLAN_PRICES_USD.free,
      cadence: "forever",
      tagline: "For tinkering and side projects.",
      cta: "Start for free",
      style: "ghost" as const,
      featured: false,
      features: [
        `${fmt(free.linksLimit ?? 0)} links per month`,
        `${fmt(free.eventsLimit ?? 0)} tracked events`,
        `${free.analyticsRangeLimitDays}-day analytics window`,
        "Standard QR codes",
        "ishortn.ink links",
      ],
    },
    {
      name: "Pro",
      price: PLAN_PRICES_USD.pro,
      cadence: "/month",
      tagline: "For creators, indie makers, and growing teams.",
      cta: "Try Pro free",
      style: "accent" as const,
      featured: true,
      features: [
        `${fmt(pro.linksLimit ?? 0)} links per month`,
        `${fmt(pro.eventsLimit ?? 0)} tracked events`,
        "Unlimited analytics history",
        `${pro.domainLimit} custom domains`,
        "Branded + dynamic QR codes",
        `Geotargeting (up to ${pro.geoRulesLimit} rules/link)`,
        `Click milestone alerts (${pro.milestonesPerLinkLimit}/link)`,
        "Link cloaking & password protection",
        "REST API access",
      ],
    },
    {
      name: "Ultra",
      price: PLAN_PRICES_USD.ultra,
      cadence: "/month",
      tagline: "For studios, agencies, and whoever wants no ceilings.",
      cta: "Go Ultra",
      style: "primary" as const,
      featured: false,
      features: [
        "Everything in Pro",
        "Unlimited links & events",
        "Unlimited custom domains",
        "Unlimited geo rules & milestones",
        "Team workspaces & shared library",
        "Resource transfer between accounts",
        "Priority support",
      ],
    },
  ];

export const Pricing = () => {
  const plans = buildPlans(false);

  return (
    <section
      id="pricing"
      className="warm-section"
      style={{ background: "var(--warm-bg)" }}
    >
      <div className="warm-container">
        <div
          style={{
            textAlign: "center",
            maxWidth: 720,
            margin: "0 auto 56px",
          }}
        >
          <div
            className="warm-eyebrow"
            style={{ marginBottom: 20, justifyContent: "center" }}
          >
            <Icon.Heart
              style={{
                width: 12,
                height: 12,
                color: "var(--warm-accent)",
              }}
            />
            Fair pricing
          </div>
          <h2
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(44px, 7vw, 80px)" }}
          >
            Simple prices,
            <br />
            <em style={{ fontStyle: "italic" }}>no surprises.</em>
          </h2>
          <p
            style={{
              fontSize: 17,
              color: "var(--warm-mute)",
              marginTop: 20,
              lineHeight: 1.6,
            }}
          >
            Start free forever. Upgrade when you're ready. Cancel in one click.
          </p>
        </div>

        <div
          className="warm-pricing-grid"
          style={{ display: "grid", gap: 20 }}
        >
          {plans.map((p) => (
            <div
              key={p.name}
              style={{
                background: p.featured ? "var(--warm-ink)" : "var(--warm-paper)",
                color: p.featured ? "var(--warm-paper)" : "var(--warm-ink)",
                border: `1px solid ${p.featured ? "var(--warm-ink)" : "var(--warm-line)"}`,
                borderRadius: 24,
                padding: 32,
                position: "relative",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {p.featured && (
                <div
                  style={{
                    position: "absolute",
                    top: -12,
                    left: 32,
                    padding: "4px 12px",
                    background: "var(--warm-accent)",
                    color: "#fff",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                  }}
                >
                  ♥ Most popular
                </div>
              )}
              <h3
                style={{
                  fontFamily: "var(--font-warm-display)",
                  fontSize: 30,
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                {p.name}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  opacity: 0.7,
                  margin: "8px 0 24px",
                  lineHeight: 1.5,
                }}
              >
                {p.tagline}
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  marginBottom: 24,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-warm-display)",
                    fontSize: 60,
                    lineHeight: 1,
                    fontWeight: 500,
                  }}
                >
                  ${p.price}
                </span>
                <span style={{ fontSize: 13, opacity: 0.6 }}>{p.cadence}</span>
              </div>
              <button
                type="button"
                className={`warm-btn warm-btn-lg ${
                  p.style === "accent"
                    ? "warm-btn-accent"
                    : p.style === "primary"
                      ? "warm-btn-primary"
                      : "warm-btn-ghost"
                }`}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  marginBottom: 24,
                }}
              >
                {p.cta} <Icon.Arrow />
              </button>
              <div
                style={{
                  height: 1,
                  background: "currentColor",
                  opacity: 0.12,
                  marginBottom: 20,
                }}
              />
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {p.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: "flex",
                      gap: 12,
                      fontSize: 14,
                      alignItems: "flex-start",
                    }}
                  >
                    <Icon.Check
                      style={{
                        width: 14,
                        height: 14,
                        color: p.featured
                          ? "var(--warm-accent)"
                          : "var(--warm-sage-deep)",
                        flexShrink: 0,
                        marginTop: 3,
                      }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .warm-pricing-grid { grid-template-columns: 1fr; }
        @media (min-width: 780px) { .warm-pricing-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
    </section>
  );
};

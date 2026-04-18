"use client";

import { useState } from "react";

import { Icon } from "./warm-primitives";

const heroCards = [
  { bg: "var(--warm-paper)", slug: "open-house", count: "2,841", flag: "🇺🇸", delta: "+24%" },
  { bg: "var(--warm-cream)", slug: "summer-zine", count: "1,204", flag: "🇬🇧", delta: "+18%" },
  { bg: "#E4EADD", slug: "field-notes", count: "912", flag: "🇯🇵", delta: "+6%" },
];

export const Hero = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const shorten = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    const target = `/auth/sign-up?url=${encodeURIComponent(trimmed)}`;
    window.location.assign(target);
  };

  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "40px 0 96px",
      }}
    >
      <div
        className="warm-container warm-hero-grid"
        style={{
          display: "grid",
          gap: 60,
          alignItems: "center",
        }}
      >
        <div>
          <div className="warm-eyebrow" style={{ marginBottom: 28 }}>
            <span className="warm-eyebrow-dot" />
            Loved by 40,000+ creators &amp; small teams
          </div>
          <h1
            className="warm-display warm-hero-title"
            style={{ margin: 0, fontSize: "clamp(54px, 9vw, 104px)" }}
          >
            Links, made
            <br />
            <em
              style={{
                color: "var(--warm-accent)",
                fontWeight: 400,
                fontStyle: "italic",
              }}
            >
              lovely.
            </em>
          </h1>
          <p
            style={{
              fontSize: 19,
              color: "var(--warm-mute)",
              lineHeight: 1.6,
              marginTop: 28,
              maxWidth: 500,
              textWrap: "pretty" as const,
            }}
          >
            Shorten any link in a second. See who clicked, and from where. Make
            QR codes that match your brand. A quiet, friendly tool — no
            spreadsheets required.
          </p>

          <form
            onSubmit={shorten}
            className="warm-hero-form"
            style={{
              background: "var(--warm-paper)",
              marginTop: 40,
              border: "1px solid var(--warm-line)",
              boxShadow: "0 12px 40px -20px rgba(43,31,23,0.15)",
              maxWidth: 620,
            }}
          >
            <label
              className="warm-hero-form-field"
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 14px 0 18px",
                  color: "var(--warm-mute)",
                }}
              >
                <Icon.Link />
              </span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Paste a long link here..."
                style={{
                  flex: 1,
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 16,
                  padding: "12px 0",
                  color: "var(--warm-ink)",
                  minWidth: 0,
                }}
              />
            </label>
            <button
              type="submit"
              className="warm-btn warm-btn-accent warm-btn-lg warm-hero-form-submit"
              style={{ margin: 0 }}
            >
              {loading ? (
                "Taking you in…"
              ) : (
                <>
                  Make it short <Icon.Arrow />
                </>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: 14,
              fontSize: 13,
              color: "var(--warm-mute)",
            }}
          >
            Free to start — no credit card. Quick sign-up, your URL comes
            along for the ride.
          </div>
        </div>

        <div
          className="warm-hero-cards"
          style={{ position: "relative", height: 460 }}
        >
          {heroCards.map((c, i) => (
            <div
              key={c.slug}
              style={{
                position: "absolute",
                top: i * 54,
                left: i * 26,
                right: -i * 8,
                background: c.bg,
                borderRadius: 22,
                padding: "26px 28px",
                border: "1px solid var(--warm-line)",
                transform: `rotate(${(i - 1) * 1.8}deg)`,
                boxShadow: "0 24px 50px -25px rgba(43,31,23,0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-warm-display)",
                    fontSize: 28,
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                  }}
                >
                  ishortn.ink/
                  <span style={{ color: "var(--warm-accent)" }}>{c.slug}</span>
                </div>
                <span style={{ fontSize: 20 }}>{c.flag}</span>
              </div>
              <div
                style={{
                  marginTop: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "var(--warm-mute)" }}>
                    Clicks this week
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-warm-display)",
                      fontSize: 32,
                      fontWeight: 500,
                      lineHeight: 1.1,
                    }}
                  >
                    {c.count}
                  </div>
                </div>
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: "var(--warm-sage)",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  ↑ {c.delta}
                </div>
              </div>
              <svg
                viewBox="0 0 200 40"
                width="100%"
                height="40"
                style={{ marginTop: 14 }}
              >
                <path
                  d={`M 0 ${30 - i * 4} Q 40 ${10 + i * 5}, 80 ${20 - i * 2} T 160 ${12 + i * 3} T 200 ${8 + i * 2}`}
                  stroke="var(--warm-accent)"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
            </div>
          ))}
        </div>
      </div>

      <div
        className="warm-container"
        style={{
          marginTop: 96,
          display: "flex",
          alignItems: "center",
          gap: 40,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--warm-mute)" }}>
          Featured on
        </span>
        {[
          "Product Hunt #1",
          "Indie Hackers",
          "Sidebar",
          "Designer News",
          "The Newsletter",
        ].map((x) => (
          <span
            key={x}
            style={{
              fontFamily: "var(--font-warm-display)",
              fontSize: 18,
              color: "var(--warm-ink-soft)",
              opacity: 0.7,
            }}
          >
            {x}
          </span>
        ))}
      </div>

      <style>{`
        .warm-hero-grid {
          grid-template-columns: 1fr;
        }
        .warm-hero-cards {
          display: none;
        }

        /* Mobile-first: form stacks vertically inside a rounded card so the
           input stays full-width and the submit button sits below. */
        .warm-hero-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px;
          border-radius: 22px;
        }
        .warm-hero-form-field {
          padding: 4px 0;
        }
        .warm-hero-form-submit {
          width: 100%;
          justify-content: center;
        }

        /* From ~640px up, collapse back to the single pill-shaped row. */
        @media (min-width: 640px) {
          .warm-hero-form {
            flex-direction: row;
            align-items: stretch;
            gap: 0;
            padding: 8px;
            border-radius: 999px;
          }
          .warm-hero-form-submit {
            width: auto;
          }
        }

        @media (min-width: 980px) {
          .warm-hero-grid {
            grid-template-columns: 1.3fr 1fr;
          }
          .warm-hero-cards {
            display: block;
          }
        }
      `}</style>
    </section>
  );
};

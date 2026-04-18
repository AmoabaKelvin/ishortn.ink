"use client";

import { useState } from "react";

import { Icon } from "./warm-primitives";

const defaultFaqs = [
  {
    q: "Is there a free plan?",
    a:
      "Yes. The Free plan gives you 30 links a month and 1,000 tracked events, forever. No card, no trial expiry.",
  },
  {
    q: "What makes iShortn different from Bitly or TinyURL?",
    a:
      "Three things: the analytics are easy to understand, the QR codes actually look nice, and we don't inject ads or weird interstitials. Also we're a lot cheaper when you do upgrade.",
  },
  {
    q: "Can I use my own domain, like yourbrand.co?",
    a:
      "Yes, from the Pro plan up. Add one setting in your domain provider (a CNAME), and we take care of everything else. Usually ready in under two minutes.",
  },
  {
    q: "What happens if I have a typo in a link?",
    a:
      "You can edit where any short link points to, anytime. The short link itself never changes — so the copy you already sent out still works.",
  },
  {
    q: "Will my links keep working if I cancel?",
    a:
      "Yes, for 30 days after cancellation, so you have time to move or update them. You can also export everything — links and stats — as a CSV or JSON file at any time.",
  },
  {
    q: "Is this safe and private?",
    a:
      "Always. We don't sell data. You can turn off tracking per link if you prefer. All traffic is HTTPS, and we follow GDPR guidelines.",
  },
];

type FaqShape = { q: string; a: string };

export const Faq = ({ faqs = defaultFaqs }: { faqs?: FaqShape[] }) => {
  const [open, setOpen] = useState<number>(0);

  return (
    <section
      id="help"
      className="warm-section"
      style={{ background: "var(--warm-bg)" }}
    >
      <div
        className="warm-container warm-faq-grid"
        style={{
          display: "grid",
          gap: 48,
          alignItems: "start",
          maxWidth: 1000,
        }}
      >
        <div className="warm-faq-intro">
          <div className="warm-eyebrow" style={{ marginBottom: 20 }}>
            <Icon.Sparkle
              style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
            />
            Common questions
          </div>
          <h2
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(40px, 6vw, 60px)" }}
          >
            Anything else?
            <br />
            <em style={{ fontStyle: "italic" }}>We're here.</em>
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "var(--warm-mute)",
              marginTop: 20,
              lineHeight: 1.6,
            }}
          >
            Can't find the answer?{" "}
            <a
              href="mailto:support@ishortn.ink"
              style={{
                color: "var(--warm-accent)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              Send us a note →
            </a>
          </p>
        </div>

        <div>
          {faqs.map((it, i) => (
            <div
              key={it.q}
              style={{
                borderTop: "1px solid var(--warm-line)",
                borderBottom:
                  i === faqs.length - 1
                    ? "1px solid var(--warm-line)"
                    : "none",
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? -1 : i)}
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "26px 0",
                  gap: 40,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "inherit",
                  fontFamily: "inherit",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-warm-display)",
                    fontSize: 24,
                    fontWeight: 500,
                    letterSpacing: "-0.015em",
                    lineHeight: 1.2,
                  }}
                >
                  {it.q}
                </span>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background:
                      open === i ? "var(--warm-accent)" : "var(--warm-paper)",
                    border: "1px solid var(--warm-line)",
                    color: open === i ? "#fff" : "var(--warm-ink)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    transform: open === i ? "rotate(45deg)" : "rotate(0)",
                    transition: "all .25s",
                  }}
                >
                  <Icon.Plus style={{ width: 12, height: 12 }} />
                </span>
              </button>
              <div
                style={{
                  maxHeight: open === i ? 400 : 0,
                  overflow: "hidden",
                  transition: "max-height .3s ease",
                }}
              >
                <p
                  style={{
                    padding: "0 0 26px 0",
                    fontSize: 15,
                    color: "var(--warm-mute)",
                    lineHeight: 1.65,
                    margin: 0,
                    maxWidth: 600,
                    textWrap: "pretty" as const,
                  }}
                >
                  {it.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .warm-faq-grid { grid-template-columns: 1fr; }
        @media (min-width: 860px) {
          .warm-faq-grid { grid-template-columns: 340px 1fr; gap: 80px; }
          .warm-faq-intro { position: sticky; top: 100px; }
        }
      `}</style>
    </section>
  );
};

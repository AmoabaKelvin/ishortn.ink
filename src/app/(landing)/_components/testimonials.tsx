import { Icon } from "./warm-primitives";

const quotes = [
  {
    q:
      "This tool is a godsend. I am using the link shortener and the QR code generator. It does everything I need it to.",
    name: "FixatedManufacturing",
    role: "Small Business Owner",
    large: true,
  },
  {
    q:
      "We pasted posters around town using the QR codes and now we know which ones perform best. It has really helped us grow.",
    name: "Plamagandalla",
    role: "Marketing Team",
  },
  {
    q:
      "Looks awesome. Minimalist and accurate. Exactly what I was looking for. Clean interface, fast redirects, and the analytics are spot on.",
    name: "Anonymous",
    role: "Developer",
  },
  {
    q:
      "The QR codes look great on our packaging. Finally something I'm not embarrassed to print.",
    name: "Sachi Tanaka",
    role: "Founder, Fieldnotes",
  },
  {
    q:
      "Switched from Bitly in ten minutes. My links are mine again, and they look nice now.",
    name: "Devon Park",
    role: "Indie maker",
  },
];

const bgs = [
  "var(--warm-ink)",
  "var(--warm-cream)",
  "var(--warm-bg)",
  "var(--warm-accent)",
  "var(--warm-paper)",
];

export const Testimonials = () => {
  return (
    <section
      id="stories"
      className="warm-section warm-section-paper"
      style={{ background: "var(--warm-paper)" }}
    >
      <div className="warm-container">
        <div
          className="warm-testi-header"
          style={{
            display: "grid",
            gap: 40,
            alignItems: "end",
            marginBottom: 60,
          }}
        >
          <div>
            <div className="warm-eyebrow" style={{ marginBottom: 20 }}>
              <Icon.Heart
                style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
              />
              From the folks using it
            </div>
            <h2
              className="warm-display"
              style={{ margin: 0, fontSize: "clamp(44px, 7vw, 80px)" }}
            >
              Kind words
              <br />
              <em style={{ fontStyle: "italic" }}>from real people.</em>
            </h2>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
              paddingBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 2 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Icon.Star
                  key={i}
                  style={{
                    width: 18,
                    height: 18,
                    color: "var(--warm-accent)",
                  }}
                />
              ))}
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-warm-display)",
                  fontSize: 28,
                  lineHeight: 1,
                }}
              >
                4.9 / 5
              </div>
              <div style={{ fontSize: 12, color: "var(--warm-mute)", marginTop: 2 }}>
                from 2,400+ reviews
              </div>
            </div>
          </div>
        </div>

        <div className="warm-testi-grid" style={{ display: "grid", gap: 20 }}>
          {quotes.map((t, i) => {
            const span = t.large ? 4 : i === 1 ? 2 : 3;
            const bg = bgs[i] ?? "var(--warm-paper)";
            const onDark = i === 0 || i === 3;
            const color = onDark ? "var(--warm-paper)" : "var(--warm-ink)";
            return (
              <div
                key={t.name}
                style={{
                  gridColumn: `span ${span}`,
                  background: bg,
                  color,
                  border: onDark ? "none" : "1px solid var(--warm-line)",
                  borderRadius: 24,
                  padding: t.large ? 44 : 28,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  minHeight: t.large ? 280 : 200,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-warm-display)",
                    fontSize: t.large ? 100 : 60,
                    lineHeight: 0.6,
                    opacity: 0.5,
                    height: t.large ? 50 : 30,
                  }}
                >
                  "
                </span>
                <p
                  style={{
                    fontFamily: t.large
                      ? "var(--font-warm-display)"
                      : "var(--font-warm-ui)",
                    fontSize: t.large ? 28 : 15,
                    lineHeight: t.large ? 1.3 : 1.55,
                    margin: 0,
                    flex: 1,
                    textWrap: "pretty" as const,
                    letterSpacing: t.large ? "-0.015em" : 0,
                    fontWeight: 400,
                  }}
                >
                  {t.q}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    paddingTop: 14,
                    borderTop: `1px solid ${
                      onDark ? "rgba(255,255,255,0.15)" : "var(--warm-line-soft)"
                    }`,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: onDark ? "var(--warm-accent)" : "var(--warm-ink)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--font-warm-display)",
                      fontSize: 15,
                    }}
                  >
                    {t.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>{t.role}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        .warm-testi-header { grid-template-columns: 1fr; }
        .warm-testi-grid { grid-template-columns: 1fr; }
        @media (min-width: 800px) {
          .warm-testi-header { grid-template-columns: auto 1fr; gap: 60px; }
          .warm-testi-grid { grid-template-columns: repeat(6, 1fr); }
        }
      `}</style>
    </section>
  );
};

import { Link } from "next-view-transitions";

import { Wordmark } from "./warm-primitives";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
      { label: "API docs", href: "https://docs.ishortn.ink/api" },
      { label: "Open dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Compare",
    links: [
      { label: "vs Bitly", href: "/compare/bitly" },
      { label: "vs TinyURL", href: "/compare/tinyurl" },
      { label: "vs Rebrandly", href: "/compare/rebrandly" },
      { label: "vs Short.io", href: "/compare/short-io" },
      { label: "vs Dub", href: "/compare/dub" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Documentation", href: "https://ishortn.ink/docs" },
      { label: "Support", href: "mailto:support@ishortn.ink" },
      { label: "Status", href: "https://status.ishortn.ink" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

const socials = [
  { label: "𝕏", href: "https://twitter.com/kelamoaba" },
  { label: "GH", href: "https://github.com/AmoabaKelvin/ishortn.ink" },
  { label: "@", href: "mailto:support@ishortn.ink" },
];

export const Footer = () => {
  return (
    <footer
      style={{
        background: "var(--warm-ink)",
        color: "var(--warm-paper)",
        padding: "64px 0 32px",
        overflow: "hidden",
      }}
    >
      <div className="warm-container">
        <div
          style={{
            display: "grid",
            gap: 60,
            paddingBottom: 60,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
          className="warm-footer-grid"
        >
          <div>
            <Wordmark onInk />
            <p
              style={{
                fontSize: 14,
                color: "rgba(252,245,238,0.65)",
                marginTop: 20,
                maxWidth: 280,
                lineHeight: 1.6,
              }}
            >
              A quietly lovely URL shortener — for people who make things on the
              internet.
            </p>
            <div style={{ marginTop: 28, display: "flex", gap: 10 }}>
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.15)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    color: "rgba(252,245,238,0.7)",
                    transition: "all .2s",
                  }}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(252,245,238,0.5)",
                  marginBottom: 18,
                  letterSpacing: "0.02em",
                }}
              >
                {col.title}
              </div>
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
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith("http") || l.href.startsWith("mailto:") ? (
                      <a
                        href={l.href}
                        target={l.href.startsWith("http") ? "_blank" : undefined}
                        rel={
                          l.href.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                        style={{
                          fontSize: 14,
                          color: "var(--warm-paper)",
                          opacity: 0.8,
                        }}
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        style={{
                          fontSize: 14,
                          color: "var(--warm-paper)",
                          opacity: 0.8,
                        }}
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          style={{
            paddingTop: 28,
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "rgba(252,245,238,0.5)",
          }}
        >
          <div>
            © {new Date().getFullYear()} iShortn — built by{" "}
            <a
              href="https://twitter.com/kelamoaba"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "rgba(252,245,238,0.75)" }}
            >
              Amoaba Kelvin
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--warm-sage)",
              }}
            />
            All systems normal
          </div>
        </div>
        <div
          aria-hidden
          style={{
            marginTop: 48,
            fontFamily: "var(--font-warm-display)",
            fontSize: "clamp(80px, 20vw, 300px)",
            lineHeight: 0.8,
            color: "rgba(255,255,255,0.04)",
            letterSpacing: "-0.03em",
            textAlign: "center",
            userSelect: "none",
            fontStyle: "italic",
            whiteSpace: "nowrap",
          }}
        >
          iShortn
          <span style={{ color: "var(--warm-accent)", opacity: 0.5 }}>.</span>
        </div>
      </div>
      <style>{`
        .warm-footer-grid {
          grid-template-columns: 1fr;
        }
        @media (min-width: 720px) {
          .warm-footer-grid {
            grid-template-columns: 1.4fr repeat(2, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .warm-footer-grid {
            grid-template-columns: 1.4fr repeat(4, 1fr);
          }
        }
      `}</style>
    </footer>
  );
};

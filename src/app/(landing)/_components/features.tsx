"use client";

import { useMemo, type CSSProperties } from "react";
import { encode } from "uqr";

import { Icon } from "./warm-primitives";

type VisualKind =
  | "analytics"
  | "domain"
  | "lock"
  | "geo"
  | "dynamic-qr"
  | "utm"
  | "milestones"
  | "cloaking"
  | "team";

type FeatureItem = {
  title: string;
  body: string;
  bg: string;
  visual: VisualKind;
};

const items: FeatureItem[] = [
  {
    title: "Analytics that don't hurt to read",
    body:
      "Clicks, unique visitors, countries, cities, devices, referrers, and a timeline. All on a warm, readable dashboard — no cookie banners to install.",
    bg: "var(--warm-cream)",
    visual: "analytics",
  },
  {
    title: "Your own custom domain",
    body:
      "Use go.yourbrand.com/spring instead of ishortn.ink. Takes ~90 seconds with a CNAME. Pro gets 3, Ultra gets unlimited.",
    bg: "var(--warm-paper)",
    visual: "domain",
  },
  {
    title: "Dynamic, brandable QR codes",
    body:
      "Pick a dot style, drop in your logo, and edit the destination any time — without reprinting. Every scan is tracked.",
    bg: "#E4EADD",
    visual: "dynamic-qr",
  },
  {
    title: "Geotargeting per link",
    body:
      "Send US visitors to one URL, EU to another, everyone else to a fallback. Country, continent, or block-by-region rules.",
    bg: "var(--warm-paper)",
    visual: "geo",
  },
  {
    title: "Password-protect & cloak",
    body:
      "Gate sensitive links behind a password, or keep your short URL visible while the destination loads. Both ship on every plan.",
    bg: "#F0E6CF",
    visual: "lock",
  },
  {
    title: "UTM templates that auto-apply",
    body:
      "Save your UTM presets once, apply them to any link with a click. No more hand-typing utm_source on every campaign.",
    bg: "var(--warm-paper)",
    visual: "utm",
  },
  {
    title: "Click milestones by email",
    body:
      "Set thresholds — 100, 1,000, whatever — and get a note the moment a link crosses it. Never miss a launch going viral.",
    bg: "#E4EADD",
    visual: "milestones",
  },
  {
    title: "Team workspaces",
    body:
      "Invite teammates, share a library, transfer resources between accounts. Ultra plan includes unlimited members.",
    bg: "var(--warm-cream)",
    visual: "team",
  },
  {
    title: "Verified clicks, not just clicks",
    body:
      "We separate real human visitors from link scanners and preview bots, so \"1,200 clicks\" means 1,200 actual people.",
    bg: "var(--warm-paper)",
    visual: "cloaking",
  },
];

const DynamicQRVisual = () => {
  const qr = useMemo(() => encode("https://ishortn.ink", { ecc: "H", border: 0 }), []);
  const data = qr.data as boolean[][];
  const size = data.length;
  return (
    <div
      style={{
        height: 128,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ position: "relative", width: 128, height: 128 }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width="128"
          height="128"
          shapeRendering="auto"
          style={{ display: "block" }}
          role="img"
          aria-label="QR code for https://ishortn.ink"
        >
          {data.flatMap((row, y) =>
            row.map((v, x) =>
              v ? (
                <circle
                  key={`${x}-${y}`}
                  cx={x + 0.5}
                  cy={y + 0.5}
                  r={0.42}
                  fill="var(--warm-ink)"
                />
              ) : null,
            ),
          )}
        </svg>
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--warm-accent)",
            boxShadow: "0 0 0 4px var(--warm-paper)",
          }}
        />
      </div>
    </div>
  );
};

const FeatureVisual = ({ kind }: { kind: VisualKind }) => {
  const boxStyle: CSSProperties = {
    height: 128,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (kind === "analytics") {
    const heights = [42, 68, 54, 82, 61, 94, 72];
    return (
      <div style={boxStyle}>
        <svg width="100%" height="128" viewBox="0 0 260 128">
          <defs>
            <linearGradient id="warm-bars-fade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--warm-accent)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--warm-accent)" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <text
            x="16"
            y="18"
            fontSize="10"
            fill="var(--warm-mute)"
            fontFamily="var(--font-warm-ui)"
          >
            Clicks · last 7 days
          </text>
          <text
            x="16"
            y="44"
            fontSize="22"
            fill="var(--warm-ink)"
            fontFamily="var(--font-warm-display)"
            fontWeight="500"
            letterSpacing="-0.02em"
          >
            24,847
          </text>
          {heights.map((h, i) => (
            <rect
              key={i}
              x={120 + i * 18}
              y={110 - h}
              width={12}
              height={h}
              rx={3}
              fill="url(#warm-bars-fade)"
            />
          ))}
          <line
            x1="16"
            x2="244"
            y1="120"
            y2="120"
            stroke="var(--warm-line)"
            strokeWidth="1"
          />
        </svg>
      </div>
    );
  }

  if (kind === "domain") {
    return (
      <div style={boxStyle}>
        <div
          style={{
            fontFamily: "var(--font-warm-display)",
            fontSize: 22,
            letterSpacing: "-0.01em",
            textAlign: "center",
          }}
        >
          go.
          <span
            style={{
              background: "var(--warm-accent)",
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 6,
            }}
          >
            yourbrand
          </span>
          .com
        </div>
      </div>
    );
  }

  if (kind === "lock") {
    return (
      <div style={boxStyle}>
        <div
          style={{
            background: "var(--warm-paper)",
            border: "1px solid var(--warm-line)",
            borderRadius: 12,
            padding: "14px 18px",
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--warm-mute)", marginBottom: 6 }}>
            Protected link
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 16,
              letterSpacing: 3,
              color: "var(--warm-ink)",
            }}
          >
            ••••••••
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--warm-accent)",
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--warm-accent)",
              }}
            />
            Expires in 24h
          </div>
        </div>
      </div>
    );
  }

  if (kind === "geo") {
    return (
      <div style={boxStyle}>
        <svg width="100%" height="128" viewBox="0 0 260 128">
          <rect width="260" height="128" fill="transparent" />
          <text
            x="16"
            y="20"
            fontSize="10"
            fill="var(--warm-mute)"
            fontFamily="var(--font-warm-ui)"
          >
            Route by country
          </text>
          {[
            { flag: "🇺🇸", label: "US", dest: "/us", y: 34 },
            { flag: "🇯🇵", label: "JP", dest: "/jp", y: 64 },
            { flag: "🌍", label: "Rest", dest: "/global", y: 94 },
          ].map((row) => (
            <g key={row.label}>
              <rect
                x="16"
                y={row.y}
                width="228"
                height="22"
                rx="11"
                fill="var(--warm-paper)"
                stroke="var(--warm-line)"
              />
              <text
                x="28"
                y={row.y + 15}
                fontSize="11"
                fontFamily="var(--font-warm-ui)"
                fill="var(--warm-ink)"
              >
                {row.flag} {row.label}
              </text>
              <text
                x="126"
                y={row.y + 15}
                fontSize="10"
                fontFamily="var(--font-warm-ui)"
                fill="var(--warm-mute)"
              >
                →
              </text>
              <text
                x="138"
                y={row.y + 15}
                fontSize="11"
                fontFamily="var(--font-warm-display)"
                fontStyle="italic"
                fill="var(--warm-accent)"
              >
                ishortn.ink{row.dest}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (kind === "dynamic-qr") {
    return <DynamicQRVisual />;
  }

  if (kind === "utm") {
    return (
      <div style={boxStyle}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            background: "var(--warm-paper)",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid var(--warm-line)",
            lineHeight: 1.6,
            color: "var(--warm-mute)",
          }}
        >
          <div>
            ?utm_source=
            <span style={{ color: "var(--warm-accent)" }}>newsletter</span>
          </div>
          <div>
            &utm_medium=
            <span style={{ color: "var(--warm-accent)" }}>email</span>
          </div>
          <div>
            &utm_campaign=
            <span style={{ color: "var(--warm-accent)" }}>spring-26</span>
          </div>
        </div>
      </div>
    );
  }

  if (kind === "milestones") {
    return (
      <div style={boxStyle}>
        <svg width="100%" height="128" viewBox="0 0 260 128">
          <text
            x="16"
            y="20"
            fontSize="10"
            fill="var(--warm-mute)"
            fontFamily="var(--font-warm-ui)"
          >
            Ping me when →
          </text>
          {[
            { n: 100, pct: 100 },
            { n: 1000, pct: 60 },
            { n: 10000, pct: 12 },
          ].map((m, i) => (
            <g key={m.n} transform={`translate(16, ${36 + i * 28})`}>
              <text
                x="0"
                y="13"
                fontSize="12"
                fontFamily="var(--font-warm-display)"
                fill="var(--warm-ink)"
              >
                {m.n.toLocaleString()}
              </text>
              <rect
                x="56"
                y="4"
                width="160"
                height="10"
                rx="5"
                fill="var(--warm-line)"
              />
              <rect
                x="56"
                y="4"
                width={160 * (m.pct / 100)}
                height="10"
                rx="5"
                fill="var(--warm-accent)"
              />
              <text
                x="222"
                y="13"
                fontSize="10"
                fontFamily="var(--font-warm-ui)"
                fill="var(--warm-mute)"
              >
                {m.pct}%
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (kind === "cloaking") {
    return (
      <div style={boxStyle}>
        <svg width="100%" height="128" viewBox="0 0 260 128">
          <rect
            x="16"
            y="18"
            width="228"
            height="32"
            rx="8"
            fill="var(--warm-paper)"
            stroke="var(--warm-line)"
          />
          <circle cx="30" cy="34" r="4" fill="var(--warm-sage)" />
          <text
            x="44"
            y="38"
            fontSize="12"
            fontFamily="var(--font-warm-display)"
            fill="var(--warm-ink)"
          >
            ishortn.ink/launch
          </text>
          <text
            x="16"
            y="68"
            fontSize="10"
            fontFamily="var(--font-warm-ui)"
            fill="var(--warm-mute)"
          >
            Real: 1,284 · Bots filtered: 412
          </text>
          <rect
            x="16"
            y="78"
            width={228 * 0.76}
            height="8"
            rx="4"
            fill="var(--warm-accent)"
          />
          <rect
            x={16 + 228 * 0.76}
            y="78"
            width={228 * 0.24}
            height="8"
            rx="4"
            fill="var(--warm-line)"
          />
          <text
            x="16"
            y="106"
            fontSize="9"
            fontFamily="var(--font-warm-ui)"
            fill="var(--warm-mute)"
          >
            Verified humans · Preview bots
          </text>
        </svg>
      </div>
    );
  }

  // team
  return (
    <div style={boxStyle}>
      <div style={{ display: "flex", gap: -8, alignItems: "center" }}>
        {["A", "K", "M", "+"].map((ch, i) => (
          <div
            key={ch}
            style={{
              width: 44,
              height: 44,
              marginLeft: i === 0 ? 0 : -12,
              borderRadius: "50%",
              background:
                ch === "+"
                  ? "var(--warm-paper)"
                  : i === 0
                    ? "var(--warm-accent)"
                    : i === 1
                      ? "var(--warm-ink)"
                      : "var(--warm-sage)",
              color: ch === "+" ? "var(--warm-ink-soft)" : "#fff",
              border: "2px solid var(--warm-paper)",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-warm-display)",
              fontSize: 18,
              fontWeight: 500,
            }}
          >
            {ch}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Features = () => {
  return (
    <section
      className="warm-section"
      style={{ background: "var(--warm-bg)" }}
    >
      <div className="warm-container">
        <div
          className="warm-features-header"
          style={{
            display: "grid",
            gap: 40,
            alignItems: "end",
            marginBottom: 64,
          }}
        >
          <div>
            <div className="warm-eyebrow" style={{ marginBottom: 20 }}>
              <Icon.Sparkle
                style={{
                  width: 12,
                  height: 12,
                  color: "var(--warm-accent)",
                }}
              />
              Everything inside
            </div>
            <h2
              className="warm-display"
              style={{ margin: 0, fontSize: "clamp(44px, 7vw, 80px)" }}
            >
              Built for the way
              <br />
              <em style={{ fontStyle: "italic" }}>you actually work.</em>
            </h2>
          </div>
          <p
            style={{
              fontSize: 17,
              color: "var(--warm-mute)",
              lineHeight: 1.6,
              maxWidth: 440,
              paddingBottom: 12,
              margin: 0,
            }}
          >
            Every feature below is live in iShortn today — not on a roadmap.
            If you see it here, you can use it tonight.
          </p>
        </div>

        <div
          className="warm-features-grid"
          style={{ display: "grid", gap: 20 }}
        >
          {items.map((it) => (
            <div
              key={it.title}
              style={{
                background: it.bg,
                borderRadius: 24,
                padding: "28px 26px 26px",
                border: "1px solid var(--warm-line)",
                display: "flex",
                flexDirection: "column",
                gap: 24,
                minHeight: 340,
                transition: "transform .25s",
              }}
            >
              <FeatureVisual kind={it.visual} />
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-warm-display)",
                    fontSize: 26,
                    fontWeight: 500,
                    margin: 0,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                    minHeight: "2.3em",
                  }}
                >
                  {it.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--warm-mute)",
                    marginTop: 12,
                    lineHeight: 1.6,
                    textWrap: "pretty" as const,
                  }}
                >
                  {it.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .warm-features-header { grid-template-columns: 1fr; }
        .warm-features-grid { grid-template-columns: 1fr; }
        @media (min-width: 768px) {
          .warm-features-header { grid-template-columns: 1fr 1fr; gap: 60px; }
          .warm-features-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1100px) {
          .warm-features-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </section>
  );
};

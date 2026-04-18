"use client";

import { useMemo, useState } from "react";
import { encode } from "uqr";

import { Icon, Logo } from "./warm-primitives";

type QRStyle = "square" | "rounded" | "dot" | "squircle";

const STYLES: { value: QRStyle; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "dot", label: "Dot" },
  { value: "squircle", label: "Squircle" },
];

const QR_TEXT = "https://ishortn.ink/dashboard";

const QRCanvas = ({
  data,
  style,
  fg,
  bg,
}: {
  data: boolean[][];
  style: QRStyle;
  fg: string;
  bg: string;
}) => {
  const size = data.length;
  const modules: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (data[y]?.[x]) modules.push({ x, y });
    }
  }

  const renderModule = (x: number, y: number) => {
    if (style === "dot") {
      return (
        <circle
          key={`${x}-${y}`}
          cx={x + 0.5}
          cy={y + 0.5}
          r={0.45}
          fill={fg}
        />
      );
    }
    const rx =
      style === "squircle" ? 0.45 : style === "rounded" ? 0.3 : 0;
    return (
      <rect
        key={`${x}-${y}`}
        x={x + 0.05}
        y={y + 0.05}
        width={0.9}
        height={0.9}
        rx={rx}
        fill={fg}
      />
    );
  };

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      shapeRendering={style === "dot" ? "auto" : "crispEdges"}
      style={{ display: "block" }}
      role="img"
      aria-label={`QR code for ${QR_TEXT}`}
    >
      <rect width={size} height={size} fill={bg} />
      {modules.map((m) => renderModule(m.x, m.y))}
    </svg>
  );
};

export const QRSection = () => {
  const [style, setStyle] = useState<QRStyle>("squircle");

  // Encode once with ECC H so the center logo overlay doesn't break scans.
  const qr = useMemo(() => encode(QR_TEXT, { ecc: "H", border: 0 }), []);
  const data = qr.data as boolean[][];

  return (
    <section
      className="warm-section warm-section-cream"
      style={{ background: "var(--warm-cream)" }}
    >
      <div
        className="warm-container warm-qr-grid"
        style={{
          display: "grid",
          gap: 60,
          alignItems: "center",
        }}
      >
        <div>
          <div
            className="warm-eyebrow"
            style={{ marginBottom: 20, background: "var(--warm-paper)" }}
          >
            <Icon.QR
              style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
            />
            QR codes
          </div>
          <h2
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(40px, 6.4vw, 72px)" }}
          >
            QR codes that look
            <br />
            <em style={{ fontStyle: "italic" }}>like your brand,</em>
            <br />
            not a parking ticket.
          </h2>
          <p
            style={{
              fontSize: 17,
              color: "var(--warm-mute)",
              marginTop: 24,
              lineHeight: 1.6,
              maxWidth: 460,
              textWrap: "pretty" as const,
            }}
          >
            Pick a shape. Drop in your logo. Choose a colour from your palette.
            Export as SVG or high-resolution PNG — for posters, packaging, or
            that very stylish menu.
          </p>
          <div style={{ marginTop: 32 }}>
            <div
              style={{ fontSize: 12, color: "var(--warm-mute)", marginBottom: 14 }}
            >
              Styles included · tap to try
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {STYLES.map((s) => {
                const active = s.value === style;
                return (
                  <button
                    type="button"
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    aria-label={`${s.label} style`}
                    aria-pressed={active}
                    style={{
                      width: 68,
                      height: 68,
                      padding: 10,
                      background: active
                        ? "var(--warm-accent)"
                        : "var(--warm-paper)",
                      border: `1px solid ${active ? "var(--warm-accent)" : "var(--warm-line)"}`,
                      borderRadius: 14,
                      cursor: "pointer",
                      transition: "all .15s",
                      fontFamily: "inherit",
                    }}
                  >
                    <QRCanvas
                      data={data}
                      style={s.value}
                      fg={active ? "#ffffff" : "var(--warm-ink)"}
                      bg="transparent"
                    />
                  </button>
                );
              })}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                color: "var(--warm-mute)",
                fontStyle: "italic",
                fontFamily: "var(--font-warm-display)",
              }}
            >
              Now showing: {STYLES.find((s) => s.value === style)?.label}
            </div>
          </div>
          <div
            style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}
          >
            <a
              href="/dashboard/qrcodes/create"
              className="warm-btn warm-btn-accent warm-btn-lg"
            >
              Make a QR code <Icon.Arrow />
            </a>
            <a
              href="/features"
              className="warm-btn warm-btn-ghost warm-btn-lg"
            >
              See examples
            </a>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div
            style={{
              background: "var(--warm-paper)",
              borderRadius: 32,
              padding: 48,
              aspectRatio: "1/1",
              border: "1px solid var(--warm-line)",
              boxShadow: "0 40px 80px -40px rgba(43,31,23,0.2)",
              position: "relative",
            }}
          >
            <QRCanvas
              data={data}
              style={style}
              fg="#2B1F17"
              bg="transparent"
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                width: 76,
                height: 76,
                borderRadius: 18,
                background: "var(--warm-accent)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 0 0 10px var(--warm-paper)",
              }}
            >
              <Logo size={38} color="#fff" />
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 12,
              color: "var(--warm-mute)",
              textAlign: "center",
            }}
          >
            Scan to visit ishortn.ink/dashboard
          </div>
        </div>
      </div>
      <style>{`
        .warm-qr-grid { grid-template-columns: 1fr; }
        @media (min-width: 960px) {
          .warm-qr-grid { grid-template-columns: 1fr 1fr; gap: 80px; }
        }
      `}</style>
    </section>
  );
};

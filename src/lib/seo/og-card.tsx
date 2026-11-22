import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import { encode } from "uqr";

import { buildQRPath } from "@/app/(landing)/_components/qr-path";

import { headlineFontSize } from "./og-card-layout";
import { OG_IMAGE_SIZE } from "./og-image";

import type { OgCardProps } from "./og-image";
import type { ReactNode } from "react";

// The site's social card (docs/design-language.md): monochrome blueprint, Google Sans
// headlines, no accent colour in the chrome. The fonts are read from disk, which only works at
// build time (the Worker has no filesystem), so every card route is force-static.

const INK = "#171717";
const SECONDARY = "#525252";
const MUTED = "#737373";
const CANVAS = "#f5f5f4";
const HAIRLINE = "rgba(10, 10, 10, 0.08)";
const CARD_SHADOW =
  "0 0 0 2px rgba(10, 10, 10, 0.06), 0 2px 4px rgba(10, 10, 10, 0.04), 0 12px 32px -12px rgba(10, 10, 10, 0.08)";

const FRAME = 64;
const PADDING_X = 120;
const VISUAL_LEFT = 752;
const TEXT_GAP = 48;
const TEXT_WIDTH_WITH_VISUAL = VISUAL_LEFT - PADDING_X - TEXT_GAP;
const TEXT_WIDTH_FULL = OG_IMAGE_SIZE.width - PADDING_X * 2;

const QR_TEXT = "https://ishortn.ink";

const FONT_FILES = [
  { name: "Google Sans", file: "GoogleSans-Regular.ttf", weight: 400 },
  { name: "Google Sans", file: "GoogleSans-SemiBold.ttf", weight: 600 },
  { name: "Google Sans", file: "GoogleSans-Bold.ttf", weight: 700 },
  { name: "Berkeley Mono", file: "BerkeleyMono.ttf", weight: 400 },
] as const;

let fontsPromise: Promise<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;

function loadFonts() {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async ({ name, file, weight }) => ({
      name,
      weight,
      style: "normal" as const,
      data: await readFile(join(process.cwd(), "src/app/fonts", file)),
    })),
  );
  return fontsPromise;
}

/** Renders the social card as a 1200x630 PNG. */
export async function ogCardResponse(props: OgCardProps) {
  return new ImageResponse(<OgCard {...props} />, {
    ...OG_IMAGE_SIZE,
    fonts: await loadFonts(),
  });
}

function OgCard({ eyebrow, title, subtitle, visual = "none", visualLabel }: OgCardProps) {
  const hasVisual = visual !== "none";
  const textWidth = hasVisual ? TEXT_WIDTH_WITH_VISUAL : TEXT_WIDTH_FULL;
  const headlineSize = headlineFontSize(title, textWidth);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: CANVAS,
        fontFamily: "Google Sans",
        color: INK,
      }}
    >
      <Frame />

      {visual === "links" && <LinksVisual destination={visualLabel} />}
      {visual === "qr" && <QrVisual />}
      {visual === "compare" && <CompareVisual competitor={visualLabel ?? "Others"} />}

      <div
        style={{
          position: "absolute",
          top: 96,
          bottom: 92,
          left: PADDING_X,
          width: textWidth,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Lockup />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "24px 0",
          }}
        >
          {eyebrow && (
            <div
              style={{
                fontFamily: "Berkeley Mono",
                fontSize: 20,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: MUTED,
                marginBottom: 20,
              }}
            >
              {eyebrow}
            </div>
          )}
          <div
            style={{
              display: "block",
              fontSize: headlineSize,
              fontWeight: 600,
              letterSpacing: -0.025 * headlineSize,
              lineHeight: 1.08,
              lineClamp: 3,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                display: "block",
                marginTop: 22,
                fontSize: 26,
                lineHeight: 1.35,
                color: SECONDARY,
                lineClamp: 2,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        <div style={{ fontFamily: "Berkeley Mono", fontSize: 20, color: MUTED }}>ishortn.ink</div>
      </div>
    </div>
  );
}

// Hairlines at the container edges with a `+` registration mark where they cross.
function Frame() {
  const { width, height } = OG_IMAGE_SIZE;
  const crossings = [
    [FRAME, FRAME],
    [width - FRAME, FRAME],
    [FRAME, height - FRAME],
    [width - FRAME, height - FRAME],
  ] as const;

  return (
    <>
      {[FRAME, width - FRAME].map((x) => (
        <div
          key={`v${x}`}
          style={{
            position: "absolute",
            left: x - 1,
            top: 0,
            width: 2,
            height,
            backgroundColor: HAIRLINE,
          }}
        />
      ))}
      {[FRAME, height - FRAME].map((y) => (
        <div
          key={`h${y}`}
          style={{
            position: "absolute",
            top: y - 1,
            left: 0,
            width,
            height: 2,
            backgroundColor: HAIRLINE,
          }}
        />
      ))}
      {crossings.map(([x, y]) => (
        <div
          key={`p${x}-${y}`}
          style={{
            position: "absolute",
            left: x - 17,
            top: y - 17,
            width: 34,
            height: 34,
            display: "flex",
            backgroundColor: CANVAS,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 16,
              top: 4,
              width: 2,
              height: 26,
              backgroundColor: "rgba(10, 10, 10, 0.3)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 4,
              width: 26,
              height: 2,
              backgroundColor: "rgba(10, 10, 10, 0.3)",
            }}
          />
        </div>
      ))}
    </>
  );
}

function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="-1.231 -1.231 34.462 34.462" fill="none">
      <g stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 14V8a4 4 0 0 1 4-4h6" />
        <path d="M28 18v6a4 4 0 0 1-4 4h-6" />
      </g>
      <rect x="11" y="11" width="10" height="10" rx="3" fill={INK} />
    </svg>
  );
}

function Lockup() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Mark size={42} />
      <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.03 * 36 }}>iShortn</div>
    </div>
  );
}

// Product mocks: a white card bleeding off the bottom edge, like the landing page cards.
function VisualCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        left: VISUAL_LEFT,
        right: FRAME + 16,
        top: 132,
        height: 560,
        display: "flex",
        flexDirection: "column",
        padding: 32,
        borderRadius: 28,
        backgroundColor: "white",
        boxShadow: CARD_SHADOW,
      }}
    >
      {children}
    </div>
  );
}

function LinkIcon() {
  return (
    <svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke={INK}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 15l6 -6" />
      <path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" />
      <path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" />
    </svg>
  );
}

const BARS = [38, 56, 47, 72, 61, 88, 100];

function LinksVisual({ destination }: { destination?: string }) {
  return (
    <VisualCard>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinkIcon />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "Berkeley Mono", fontSize: 22 }}>ishortn.ink/launch</div>
          <div style={{ fontSize: 18, color: MUTED }}>example.com/spring-launch</div>
        </div>
      </div>

      {destination ? (
        <div
          style={{
            display: "block",
            marginTop: 24,
            padding: "14px 16px",
            borderRadius: 14,
            backgroundColor: "#f5f5f5",
            fontFamily: "Berkeley Mono",
            fontSize: 16,
            lineHeight: 1.5,
            color: SECONDARY,
            wordBreak: "break-all",
          }}
        >
          {destination}
        </div>
      ) : null}

      <div style={{ height: 2, backgroundColor: "#f0f0f0", marginTop: 24, marginBottom: 22 }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 18, color: MUTED }}>Clicks</div>
        <div
          style={{
            fontSize: 15,
            color: SECONDARY,
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
            padding: "4px 10px",
          }}
        >
          Last 7 days
        </div>
      </div>
      <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.2, marginTop: 4 }}>12,480</div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 110, marginTop: 16 }}>
        {BARS.map((height, index) => (
          <div
            key={index}
            style={{
              flex: 1,
              height: `${height}%`,
              borderRadius: 6,
              backgroundColor: index === BARS.length - 1 ? INK : "#e5e5e5",
            }}
          />
        ))}
      </div>
    </VisualCard>
  );
}

const QR_DATA = encode(QR_TEXT, { ecc: "M", border: 0 }).data;
const QR_PATH = buildQRPath(QR_DATA, "square");

function QrVisual() {
  const modules = QR_DATA.length;
  return (
    <VisualCard>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: 20,
          borderRadius: 18,
          backgroundColor: "#f5f5f5",
        }}
      >
        <div
          style={{
            display: "flex",
            padding: 18,
            borderRadius: 14,
            backgroundColor: "white",
          }}
        >
          <svg width={220} height={220} viewBox={`0 0 ${modules} ${modules}`}>
            <path d={QR_PATH} fill={INK} />
          </svg>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 22,
        }}
      >
        <div style={{ fontFamily: "Berkeley Mono", fontSize: 20 }}>ishortn.ink/menu</div>
        <div
          style={{
            fontSize: 15,
            color: SECONDARY,
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
            padding: "4px 10px",
          }}
        >
          Dynamic
        </div>
      </div>
    </VisualCard>
  );
}

const COMPARE_ROWS = [
  [78, 62],
  [64, 48],
  [86, 54],
  [70, 40],
  [58, 66],
] as const;

function CompareVisual({ competitor }: { competitor: string }) {
  return (
    <VisualCard>
      <div style={{ display: "flex", alignItems: "center", height: 44 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
          <Mark size={26} />
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.7 }}>iShortn</div>
        </div>
        <div
          style={{
            flex: 1,
            display: "block",
            paddingLeft: 24,
            fontSize: 24,
            fontWeight: 600,
            color: SECONDARY,
            lineClamp: 1,
          }}
        >
          {competitor}
        </div>
      </div>
      <div style={{ height: 2, backgroundColor: "#f0f0f0", marginTop: 18 }} />
      {COMPARE_ROWS.map(([ours, theirs], index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            height: 58,
            borderBottom: "2px solid #f5f5f5",
          }}
        >
          <div style={{ flex: 1, display: "flex" }}>
            <div
              style={{
                width: `${ours}%`,
                height: 12,
                borderRadius: 6,
                backgroundColor: "#d4d4d4",
              }}
            />
          </div>
          <div style={{ flex: 1, display: "flex", paddingLeft: 24 }}>
            <div
              style={{
                width: `${theirs}%`,
                height: 12,
                borderRadius: 6,
                backgroundColor: "#e5e5e5",
              }}
            />
          </div>
        </div>
      ))}
    </VisualCard>
  );
}

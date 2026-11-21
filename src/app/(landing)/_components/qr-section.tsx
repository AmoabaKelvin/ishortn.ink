"use client";

import { IconQrcode } from "@tabler/icons-react";
import { useState } from "react";
import { encode } from "uqr";

import { cn } from "@/lib/utils";

import { buildQRPath, qrStrokeWidth, type QRStyle } from "./qr-path";
import {
  bodyClass,
  ButtonLink,
  cardClass,
  Eyebrow,
  Logo,
  Section,
  SectionHeading,
} from "./site-primitives";

const STYLES: { value: QRStyle; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "dot", label: "Dot" },
  { value: "squircle", label: "Squircle" },
];

const QR_TEXT = "https://ishortn.ink/dashboard";
const QR_FG = "#171717"; // neutral-900
const DEFAULT_STYLE: QRStyle = "squircle";

// Encode once with ECC H so the center logo overlay doesn't break scans. The encoding and each
// style's path live at module scope, so they're built once per process, not per render.
const QR_DATA = encode(QR_TEXT, { ecc: "H", border: 0 }).data;
const qrPaths: Partial<Record<QRStyle, string>> = {};
const getQRPath = (style: QRStyle) => (qrPaths[style] ??= buildQRPath(QR_DATA, style));

const QRCanvas = ({ style }: { style: QRStyle }) => {
  const size = QR_DATA.length;
  const strokeWidth = qrStrokeWidth(style);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      // eslint-disable-next-line anti-slop/no-shape-in-symbol-names -- SVG attribute name
      shapeRendering={style === "dot" ? "auto" : "crispEdges"}
      className="block size-full"
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- inline SVG needs role="img" to be announced as an image
      role="img"
      aria-label={`QR code for ${QR_TEXT}`}
    >
      {strokeWidth === 0 ? (
        <path d={getQRPath(style)} fill={QR_FG} />
      ) : (
        <path
          d={getQRPath(style)}
          fill="none"
          stroke={QR_FG}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

export const QRSection = () => {
  const [style, setStyle] = useState<QRStyle>(DEFAULT_STYLE);

  return (
    <Section>
      <div className="grid items-center gap-x-8 gap-y-14 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            eyebrow={<Eyebrow icon={<IconQrcode aria-hidden="true" />}>QR codes</Eyebrow>}
            title="QR codes that match your brand"
            subtitle="Pick a shape, add your logo, and use your own colors. Download a PNG that's ready for posters, packaging, or menus."
          />
          <p className={cn(bodyClass, "mt-4 max-w-[52ch]")}>
            Free includes 5 dynamic QR codes: change the destination any time without reprinting,
            they never expire, and there are no ads. Pro adds branded codes. Every scan is tracked.
          </p>

          <fieldset className="mt-8">
            <legend className="text-base font-medium text-neutral-900 sm:text-sm">
              Try a style
            </legend>
            <div className="mt-3 grid grid-cols-4 rounded-lg bg-neutral-100 p-0.5 shadow-[inset_0_0_0_1px_rgb(10_10_10/0.05)] sm:inline-grid">
              {STYLES.map((s) => {
                const active = s.value === style;
                return (
                  <button
                    type="button"
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
                      active
                        ? "bg-white text-neutral-900 shadow-site-btn"
                        : "text-neutral-600 hover:text-neutral-900",
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-8">
            <ButtonLink variant="secondary" href="/dashboard/qrcodes/create">
              Create a QR code
            </ButtonLink>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className={cn(cardClass, "relative aspect-square p-8")}>
            <QRCanvas style={style} />
            <div className="absolute left-1/2 top-1/2 grid size-[18%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-neutral-900 text-white ring-8 ring-white">
              <Logo className="size-1/2" />
            </div>
          </div>
          <p className="mt-4 text-center font-mono text-sm text-neutral-600">
            Scan to visit ishortn.ink/dashboard
          </p>
        </div>
      </div>
    </Section>
  );
};

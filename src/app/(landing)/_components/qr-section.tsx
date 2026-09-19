"use client";

import { IconQrcode } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { encode } from "uqr";

import { cn } from "@/lib/utils";

import {
  bodyClass,
  ButtonLink,
  cardClass,
  Eyebrow,
  Logo,
  Section,
  SectionHeading,
} from "./site-primitives";

type QRStyle = "square" | "rounded" | "dot" | "squircle";

const STYLES: { value: QRStyle; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "dot", label: "Dot" },
  { value: "squircle", label: "Squircle" },
];

const QR_TEXT = "https://ishortn.ink/dashboard";
const QR_FG = "#171717"; // neutral-900

const QRCanvas = ({ data, style }: { data: boolean[][]; style: QRStyle }) => {
  const size = data.length;
  const modules: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (data[y]?.[x]) modules.push({ x, y });
    }
  }

  const renderModule = (x: number, y: number) => {
    if (style === "dot") {
      return <circle key={`${x}-${y}`} cx={x + 0.5} cy={y + 0.5} r={0.45} fill={QR_FG} />;
    }
    const rx = style === "squircle" ? 0.45 : style === "rounded" ? 0.3 : 0;
    return (
      <rect
        key={`${x}-${y}`}
        x={x + 0.05}
        y={y + 0.05}
        width={0.9}
        height={0.9}
        rx={rx}
        fill={QR_FG}
      />
    );
  };

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
      {modules.map((m) => renderModule(m.x, m.y))}
    </svg>
  );
};

export const QRSection = () => {
  const [style, setStyle] = useState<QRStyle>("squircle");

  // Encode once with ECC H so the center logo overlay doesn't break scans.
  const { data } = useMemo(() => encode(QR_TEXT, { ecc: "H", border: 0 }), []);

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
            Branded and dynamic QR codes come with Pro: change the destination any time without
            reprinting. Every scan is tracked.
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
            <QRCanvas data={data} style={style} />
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

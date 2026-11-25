"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { buildQRPath, qrStrokeWidth, type QRStyle } from "./qr-path";
import { cardClass, Logo } from "./site-primitives";

import type { ReactNode } from "react";

const STYLES: { value: QRStyle; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "dot", label: "Dot" },
  { value: "squircle", label: "Squircle" },
];

const QR_FG = "#171717"; // neutral-900
const DEFAULT_STYLE: QRStyle = "squircle";

const QRCanvas = ({
  modules,
  text,
  style,
}: {
  modules: boolean[][];
  text: string;
  style: QRStyle;
}) => {
  const size = modules.length;
  const strokeWidth = qrStrokeWidth(style);
  const path = useMemo(() => buildQRPath(modules, style), [modules, style]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      // eslint-disable-next-line anti-slop/no-shape-in-symbol-names -- SVG attribute name
      shapeRendering={style === "dot" ? "auto" : "crispEdges"}
      className="block size-full"
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- inline SVG needs role="img" to be announced as an image
      role="img"
      aria-label={`QR code for ${text}`}
    >
      {strokeWidth === 0 ? (
        <path d={path} fill={QR_FG} />
      ) : (
        <path
          d={path}
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

/**
 * The interactive half of the QR section: the style picker and the code it redraws. `rows` is the
 * encoded module grid ("1" = dark), so the encoder runs on the server and never ships here.
 */
export const QRStyleDemo = ({
  rows,
  text,
  intro,
  action,
}: {
  rows: string[];
  text: string;
  intro: ReactNode;
  action: ReactNode;
}) => {
  const [style, setStyle] = useState<QRStyle>(DEFAULT_STYLE);
  const modules = useMemo(() => rows.map((row) => [...row].map((m) => m === "1")), [rows]);

  return (
    <div className="grid items-center gap-x-8 gap-y-14 lg:grid-cols-2">
      <div>
        {intro}

        <fieldset className="mt-8">
          <legend className="text-base font-medium text-neutral-900 sm:text-sm">Try a style</legend>
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

        <div className="mt-8">{action}</div>
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className={cn(cardClass, "relative aspect-square p-8")}>
          <QRCanvas modules={modules} text={text} style={style} />
          <div className="absolute left-1/2 top-1/2 grid size-[18%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-neutral-900 text-white ring-8 ring-white">
            <Logo className="size-1/2" />
          </div>
        </div>
        <p className="mt-4 text-center font-mono text-sm text-neutral-600">
          Scan to visit ishortn.ink/dashboard
        </p>
      </div>
    </div>
  );
};

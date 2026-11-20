"use client";

import { IconAlertCircle, IconDownload, IconQrcode } from "@tabler/icons-react";
import { QRCodeCanvas } from "qrcode.react";
import { useId, useRef, useState } from "react";

import { Paths } from "@/lib/constants/app";
import { cn } from "@/lib/utils";

import {
  bodyClass,
  ButtonLink,
  buttonClass,
  cardClass,
  h3Class,
  wellClass,
} from "../_components/site-primitives";
import { parseQrUrl } from "./utils";

const SIGNUP_HREF = `${Paths.Signup}?utm_source=ishortn_site&utm_medium=landing&utm_campaign=qr-code-generator`;

// Drawn at print resolution and scaled down with CSS, so the download is crisp.
const QR_EXPORT_SIZE = 1024;

// 16px text so iOS does not zoom on focus (same field as the abuse report form)
const fieldClass =
  "mt-2 block w-full rounded-[10px] bg-white px-3 py-2.5 text-base text-neutral-900 shadow-site-btn placeholder:text-neutral-500 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-900";

export function QrGenerator() {
  const [value, setValue] = useState("https://ishortn.ink");
  const previewRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const messageId = useId();

  const result = parseQrUrl(value);
  const isEmpty = value.trim() === "";

  const download = () => {
    const canvas = previewRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "qr-code.png";
    a.click();
  };

  return (
    <div className={cn(cardClass, "mx-auto max-w-4xl p-2")}>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:grid-rows-[auto_1fr]">
        {/* Input */}
        <div className="flex flex-col p-4 sm:p-6">
          <label htmlFor={inputId} className="text-base font-medium text-neutral-900 sm:text-sm">
            Website URL
          </label>
          <input
            id={inputId}
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="https://example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={!result.ok && !isEmpty}
            aria-describedby={messageId}
            className={fieldClass}
          />
          <div id={messageId} aria-live="polite" className="mt-2">
            {!result.ok && !isEmpty ? (
              <p className="flex items-start gap-1.5 text-base text-red-600 sm:text-sm">
                <IconAlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {result.error}
              </p>
            ) : (
              <p className="text-base text-neutral-600 sm:text-sm">
                The preview updates as you type. Nothing is sent or stored.
              </p>
            )}
          </div>
        </div>

        {/* Preview */}
        <div
          className={cn(
            wellClass,
            "flex flex-col items-center justify-center gap-4 p-6 md:col-start-2 md:row-span-2 md:row-start-1",
          )}
        >
          <div
            ref={previewRef}
            className="grid aspect-square w-full max-w-60 place-items-center overflow-hidden rounded-xl bg-white shadow-site-card"
          >
            {result.ok ? (
              <>
                <span className="sr-only">QR code for {result.url}</span>
                <QRCodeCanvas
                  value={result.url}
                  size={QR_EXPORT_SIZE}
                  level="M"
                  includeMargin
                  aria-hidden="true"
                  // The library sets width/height inline from `size`; override to fit the tile.
                  style={{ width: "100%", height: "auto" }}
                />
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 text-center text-neutral-500">
                <IconQrcode aria-hidden="true" className="size-8" stroke={1.5} />
                <span className="text-sm">Enter a valid URL to see your QR code</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={download}
            disabled={!result.ok}
            className={cn(buttonClass({ variant: "secondary" }), "w-full max-w-60 gap-1.5")}
          >
            <IconDownload aria-hidden="true" className="size-4 shrink-0" />
            Download PNG
          </button>
        </div>

        {/* Upgrade path: directly under the preview on mobile */}
        <div
          className={cn(wellClass, "p-5 md:col-start-1 md:row-start-2 md:m-6 md:mt-0 md:self-end")}
        >
          <h2 className={cn(h3Class, "text-lg")}>This code is static</h2>
          <p className={cn(bodyClass, "mt-2 sm:text-sm")}>
            The link is baked into the pattern, so you can&apos;t change where it goes after
            printing, and you can&apos;t see how many people scan it. A free iShortn account gives
            you dynamic codes you can edit and track.
          </p>
          <ButtonLink href={SIGNUP_HREF} className="mt-4 whitespace-normal">
            Make it dynamic and trackable, free
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

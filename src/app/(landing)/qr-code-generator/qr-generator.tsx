"use client";

import { IconAlertCircle, IconCircleCheck, IconDownload, IconQrcode } from "@tabler/icons-react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useId, useRef, useState, useSyncExternalStore } from "react";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { serializeShortenIntentCookie } from "@/lib/auth/shorten-intent";
import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";

import { useSignedIn } from "../_components/header";
import {
  bodyClass,
  ButtonLink,
  buttonClass,
  cardClass,
  fieldClass,
  h3Class,
  wellClass,
} from "../_components/site-primitives";
import { getQrSignupHref, parseQrUrl, qrUrlFromSearch, toSvgFile } from "./utils";

// Drawn at print resolution and scaled down with CSS, so the download is crisp.
const QR_EXPORT_SIZE = 1024;
const QR_LEVEL = "M";

const subscribeToNothing = () => () => {};
const readUrlParam = () => qrUrlFromSearch(window.location.search);

export function QrGenerator() {
  // The page is static, so `?url=` is read from the URL on the client (the server snapshot is the
  // default) rather than through useSearchParams, which would need a Suspense boundary.
  const urlParam = useSyncExternalStore(subscribeToNothing, readUrlParam, () => null);
  const [typed, setTyped] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<"png" | "svg" | null>(null);
  const value = typed ?? urlParam ?? "https://ishortn.ink";
  const previewRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const messageId = useId();

  const result = parseQrUrl(value);
  const isEmpty = value.trim() === "";
  // The sample URL shown before any input isn't the visitor's, so it isn't carried into sign-up.
  const enteredUrl = (typed !== null || urlParam !== null) && result.ok ? result.url : null;
  const signedIn = useSignedIn();

  const downloadPng = () => {
    const canvas = previewRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "qr-code.png";
    a.click();
    setDownloaded("png");
    trackEvent(POSTHOG_EVENTS.FREE_TOOL_USED, {
      tool: "qr_code_generator",
      action: "download_png",
    });
  };

  const downloadSvg = () => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;
    const markup = toSvgFile(new XMLSerializer().serializeToString(svg));
    const href = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = "qr-code.svg";
    a.click();
    URL.revokeObjectURL(href);
    setDownloaded("svg");
    trackEvent(POSTHOG_EVENTS.FREE_TOOL_USED, {
      tool: "qr_code_generator",
      action: "download_svg",
    });
  };

  const signupHref = getQrSignupHref(enteredUrl, signedIn);
  // Signed out, the URL goes in a cookie set on click, not the href. No prefetch on the links: the
  // sign-up page reads that cookie when it renders, so it must load after the click.
  const onSignupClick = (placement: "post_download" | "static_card") => {
    trackEvent(POSTHOG_EVENTS.FREE_TOOL_SIGNUP_CLICKED, {
      tool: "qr_code_generator",
      placement,
      signed_in: signedIn === true,
    });
    if (signedIn) return;
    document.cookie = serializeShortenIntentCookie(
      enteredUrl,
      window.location.protocol === "https:",
    );
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
            onChange={(e) => {
              setTyped(e.target.value);
              // A new URL is a new code, so the saved-file note no longer applies.
              setDownloaded(null);
            }}
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
                  level={QR_LEVEL}
                  includeMargin
                  aria-hidden="true"
                  // The library sets width/height inline from `size`; override to fit the tile.
                  style={{ width: "100%", height: "auto" }}
                />
                {/* Source for the SVG download; same value, level and quiet zone as the PNG */}
                <div ref={svgRef} hidden>
                  <QRCodeSVG
                    value={result.url}
                    size={QR_EXPORT_SIZE}
                    level={QR_LEVEL}
                    includeMargin
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 text-center text-neutral-500">
                <IconQrcode aria-hidden="true" className="size-8" stroke={1.5} />
                <span className="text-sm">Enter a valid URL to see your QR code</span>
              </div>
            )}
          </div>
          <div className="flex w-full max-w-60 flex-col gap-2">
            <button
              type="button"
              onClick={downloadPng}
              disabled={!result.ok}
              className={cn(buttonClass({ variant: "secondary" }), "w-full gap-1.5")}
            >
              <IconDownload aria-hidden="true" className="size-4 shrink-0" />
              Download PNG
            </button>
            <button
              type="button"
              onClick={downloadSvg}
              disabled={!result.ok}
              className={cn(buttonClass({ variant: "secondary" }), "w-full gap-1.5")}
            >
              <IconDownload aria-hidden="true" className="size-4 shrink-0" />
              Download SVG
            </button>
          </div>
          <div aria-live="polite" className="w-full max-w-60 empty:hidden">
            {downloaded && (
              <div className="flex flex-col gap-3 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] animate-in fade-in-0 motion-safe:slide-in-from-bottom-1">
                <p className="flex items-center gap-1.5 text-sm text-neutral-600">
                  <IconCircleCheck aria-hidden="true" className="size-4 shrink-0" />
                  Saved qr-code.{downloaded}
                </p>
                <p className="text-pretty text-sm text-neutral-600">
                  Printing it? This code can&apos;t be changed or tracked later.
                </p>
                <ButtonLink
                  href={signupHref}
                  prefetch={false}
                  onClick={() => onSignupClick("post_download")}
                  className="w-full whitespace-normal"
                >
                  {signedIn ? "Make it dynamic" : "Make it dynamic, free"}
                </ButtonLink>
                <p className="text-pretty text-xs text-neutral-500">
                  {`Free includes ${FREE_QR_CODE_LIMIT} dynamic QR codes. No card needed.`}
                </p>
              </div>
            )}
          </div>
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
          <ButtonLink
            href={signupHref}
            prefetch={false}
            onClick={() => onSignupClick("static_card")}
            className="mt-4 whitespace-normal"
          >
            {`${enteredUrl ? "Track scans of this code" : "Make it dynamic and trackable"}${signedIn ? "" : ", free"}`}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

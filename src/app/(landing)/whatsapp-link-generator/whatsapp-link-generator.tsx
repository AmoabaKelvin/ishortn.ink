"use client";

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconExternalLink,
  IconMessageCircle,
  IconQrcode,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

import { serializeShortenIntentCookie } from "@/lib/auth/shorten-intent";
import { FREE_QR_CODE_LIMIT } from "@/lib/billing/entitlements";
import { PLAN_CAPS } from "@/lib/billing/plans";
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
import { MAX_URL_LENGTH } from "../_lib/parse-url";
import { toSvgFile } from "../_lib/qr-export";
import { useCopy } from "../_lib/use-copy";
import { phoneNoteText, whatsappToolCopy } from "./copy";
import { COUNTRY_CODES } from "./country-codes";
import { formatWhatsAppLink, getShortenHref, normalizePhone } from "./utils";

import type { CopyState } from "../_lib/use-copy";
import type { WhatsAppToolLocale } from "./copy";
import type { CountryCode } from "./country-codes";
import type { ReactNode } from "react";

// Drawn at print resolution and scaled down with CSS, so the download is crisp.
const QR_EXPORT_SIZE = 1024;
const QR_LEVEL = "M";
const DENSE_QR_LENGTH = 300;
const SHOW_COUNTER_AFTER = 400;

const labelClass = "block text-base font-medium text-neutral-900 sm:text-sm";
const hintClass = "mt-1.5 text-sm text-neutral-600";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
// 44px tall on touch screens, the regular button height from sm up.
const touchTarget = "min-h-11 sm:min-h-0";

type CountryOption = CountryCode & { name: string };

const subscribeToNothing = () => () => {};

// Country names come from the browser's own locale data, so the list is built on the client only
// (the server snapshot is empty): server and browser ICU versions name some regions differently,
// which would otherwise be a hydration mismatch.
const NO_COUNTRIES: CountryOption[] = [];
// Cached per locale so useSyncExternalStore gets the same array back on every read.
const countryOptions = new Map<WhatsAppToolLocale, CountryOption[]>();
const readCountryOptions = (locale: WhatsAppToolLocale) => {
  let options = countryOptions.get(locale);
  if (!options) {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    options = COUNTRY_CODES.map((c) => ({ ...c, name: names.of(c.iso2) ?? c.iso2 })).sort((a, b) =>
      a.name.localeCompare(b.name, locale),
    );
    countryOptions.set(locale, options);
  }
  return options;
};

const readBrowserRegion = () => {
  try {
    const region = new Intl.Locale(navigator.language).region;
    return region && COUNTRY_CODES.some((c) => c.iso2 === region) ? region : "";
  } catch {
    return "";
  }
};

export function WhatsAppLinkGenerator({
  locale = "en",
  defaultRegion = "",
  campaign = "whatsapp-link",
}: {
  locale?: WhatsAppToolLocale;
  /** ISO 3166 region preselected when the browser's language names none we support. */
  defaultRegion?: string;
  /** utm_campaign on the sign-up links, so each page's sign-ups are attributed to it. */
  campaign?: string;
}) {
  const copy = whatsappToolCopy[locale];
  const countries = useSyncExternalStore(
    subscribeToNothing,
    () => readCountryOptions(locale),
    () => NO_COUNTRIES,
  );
  const browserRegion = useSyncExternalStore(subscribeToNothing, readBrowserRegion, () => "");
  const [pickedRegion, setPickedRegion] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const signedIn = useSignedIn();

  const outputRef = useRef<HTMLTextAreaElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const ids = {
    country: `${id}-country`,
    phone: `${id}-phone`,
    phoneHint: `${id}-phone-hint`,
    phoneMessage: `${id}-phone-message`,
    message: `${id}-message`,
    messageHint: `${id}-message-hint`,
    messageStatus: `${id}-message-status`,
    output: `${id}-output`,
  };

  const copier = useCopy(() => outputRef.current?.select());

  const region = pickedRegion ?? (browserRegion || defaultRegion);
  const country = countries.find((c) => c.iso2 === region);
  const phoneResult = normalizePhone(phone, country?.dial ?? "");
  const digits = phoneResult.ok ? phoneResult.digits : "";
  const hasMessage = message.trim() !== "";

  const link = formatWhatsAppLink(digits, message);
  const tooLong = link !== null && link.length > MAX_URL_LENGTH;
  const output = phoneResult.ok && link && !tooLong ? link : null;
  const isShareLink = output !== null && digits === "";

  const update = (apply: () => void) => {
    apply();
    copier.reset();
  };

  const quickFill = (text: string) => {
    // Openers that end mid-sentence put the caret after them so the visitor can finish typing.
    if (!text.endsWith(" ")) return update(() => setMessage(text));
    flushSync(() => update(() => setMessage(text)));
    const textarea = messageRef.current;
    textarea?.focus();
    textarea?.setSelectionRange(text.length, text.length);
  };

  const downloadPng = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = copy.pngFileName;
    a.click();
  };

  const downloadSvg = () => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;
    const markup = toSvgFile(new XMLSerializer().serializeToString(svg));
    const href = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = copy.svgFileName;
    a.click();
    URL.revokeObjectURL(href);
  };

  return (
    // The page promises the number and message never leave the browser: keep them out of
    // PostHog's autocaptured events.
    <div className={cn(cardClass, "ph-no-capture mx-auto max-w-4xl p-2")}>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] md:grid-rows-[auto_1fr]">
        {/* Inputs + link */}
        <div className="flex min-w-0 flex-col gap-6 p-4 sm:p-6">
          <div>
            <label htmlFor={ids.phone} className={labelClass}>
              {copy.phoneLabel}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {/* The native select sits invisibly over a compact "GB +44" face, so the full
                  "United Kingdom (+44)" names stay in the picker without truncating in the row. */}
              <div
                className={cn(
                  "relative flex w-36 flex-none items-center gap-1.5 rounded-[10px] bg-white py-2.5 pl-3 pr-8 text-base shadow-site-btn",
                  "has-[:focus]:outline has-[:focus]:outline-2 has-[:focus]:-outline-offset-1 has-[:focus]:outline-neutral-900",
                )}
              >
                <label htmlFor={ids.country} className="sr-only">
                  {copy.countryCodeLabel}
                </label>
                <select
                  id={ids.country}
                  value={country?.iso2 ?? ""}
                  onChange={(e) => update(() => setPickedRegion(e.target.value))}
                  className="absolute inset-0 cursor-pointer appearance-none rounded-[10px] text-base opacity-0"
                >
                  <option value="">{copy.includesCountryCodeOption}</option>
                  {countries.map((c) => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.name} (+{c.dial})
                    </option>
                  ))}
                </select>
                {country ? (
                  <span aria-hidden="true" className="truncate tabular-nums text-neutral-900">
                    <span className="text-neutral-500">{country.iso2}</span> +{country.dial}
                  </span>
                ) : (
                  <span aria-hidden="true" className="truncate text-neutral-500">
                    {copy.countryPlaceholder}
                  </span>
                )}
                <IconChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 size-4 text-neutral-500"
                />
              </div>
              <input
                id={ids.phone}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={copy.phonePlaceholder}
                value={phone}
                onChange={(e) => update(() => setPhone(e.target.value))}
                aria-invalid={!phoneResult.ok}
                aria-describedby={`${ids.phoneHint} ${ids.phoneMessage}`}
                className={cn(fieldClass, "mt-0 w-auto min-w-28 flex-1")}
              />
            </div>
            <p id={ids.phoneHint} className={hintClass}>
              {copy.phoneHint}
            </p>
            <div id={ids.phoneMessage} aria-live="polite">
              {!phoneResult.ok ? (
                <ErrorText className="mt-1.5">{copy.errors[phoneResult.error]}</ErrorText>
              ) : phoneResult.digits ? (
                <>
                  <p className="mt-1.5 break-all text-sm text-neutral-900">
                    {copy.opensChatWith}{" "}
                    <span className="font-medium tabular-nums">{phoneResult.display}</span>
                  </p>
                  {phoneResult.notes.map((note) => (
                    <p key={note.code} className={hintClass}>
                      {phoneNoteText(copy, note)}
                    </p>
                  ))}
                </>
              ) : null}
            </div>
          </div>

          <div>
            <label htmlFor={ids.message} className={labelClass}>
              {copy.messageLabel}{" "}
              <span className="font-normal text-neutral-600">{copy.messageOptional}</span>
            </label>
            <fieldset className="mt-2 flex flex-wrap gap-x-2 gap-y-3 sm:gap-2">
              <legend className="sr-only">{copy.quickFillLegend}</legend>
              {copy.quickFills.map((fill) => (
                <button
                  key={fill.label}
                  type="button"
                  aria-pressed={message === fill.text}
                  onClick={() => quickFill(fill.text)}
                  className={cn(
                    // Compact pill; below sm an invisible extension makes the hit area 44px tall.
                    "relative rounded-full px-3 py-1.5 text-sm font-medium max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:-inset-y-1.5 sm:py-1",
                    focusRing,
                    message === fill.text
                      ? "bg-neutral-900 text-white"
                      : "bg-white text-neutral-700 shadow-site-btn hover:bg-neutral-50 hover:text-neutral-900",
                  )}
                >
                  {fill.label}
                </button>
              ))}
            </fieldset>
            <textarea
              ref={messageRef}
              id={ids.message}
              rows={4}
              placeholder={copy.messagePlaceholder}
              value={message}
              onChange={(e) => update(() => setMessage(e.target.value))}
              aria-invalid={tooLong}
              aria-describedby={`${ids.messageHint} ${ids.messageStatus}`}
              className={cn(fieldClass, "resize-y")}
            />
            <p id={ids.messageHint} className={hintClass}>
              {copy.messageHint}
            </p>
            <div id={ids.messageStatus} aria-live="polite">
              {message.length > SHOW_COUNTER_AFTER && (
                <p className={cn(hintClass, "tabular-nums")}>
                  {copy.characters(message.length.toLocaleString(locale))}
                </p>
              )}
              {tooLong && <ErrorText className="mt-1.5">{copy.messageTooLong}</ErrorText>}
            </div>
          </div>

          <div>
            <label htmlFor={ids.output} aria-live="polite" className={labelClass}>
              {isShareLink ? copy.shareLinkLabel : copy.outputLabel}
            </label>
            <textarea
              ref={outputRef}
              id={ids.output}
              readOnly
              rows={3}
              value={output ?? ""}
              placeholder={tooLong ? copy.outputTooLong : copy.outputEmpty}
              className={cn(fieldClass, "resize-none break-all font-mono sm:text-sm")}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={!output}
                onClick={() => output && copier.copy(output)}
                className={cn(buttonClass({ variant: "primary" }), touchTarget, "gap-1.5")}
              >
                {copier.state === "copied" ? (
                  <IconCheck aria-hidden="true" className="size-4 shrink-0" />
                ) : (
                  <IconCopy aria-hidden="true" className="size-4 shrink-0" />
                )}
                {copier.state === "copied" ? copy.copied : copy.copyLink}
              </button>
              {output ? (
                <a
                  href={output}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonClass({ variant: "secondary" }), touchTarget, "gap-1.5")}
                >
                  <IconExternalLink aria-hidden="true" className="size-4 shrink-0" />
                  {copy.openInWhatsApp}
                  <span className="sr-only">{copy.opensInNewTab}</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className={cn(buttonClass({ variant: "secondary" }), touchTarget, "gap-1.5")}
                >
                  <IconExternalLink aria-hidden="true" className="size-4 shrink-0" />
                  {copy.openInWhatsApp}
                </button>
              )}
            </div>
            <CopyStatus state={copier.state} copied={copy.copied} fallback={copy.copyFallback} />
          </div>

          {hasMessage && (
            <div className={cn(wellClass, "p-4")}>
              <p className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
                <IconMessageCircle aria-hidden="true" className="size-4 shrink-0" stroke={1.5} />
                {copy.previewLabel}
              </p>
              <div className="mt-3 flex justify-end pl-12">
                <p className="max-h-60 min-w-0 overflow-y-auto whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-white px-3 py-2 text-base text-neutral-900 shadow-site-card sm:text-sm">
                  {message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* QR code: under the link on mobile, the right column on desktop */}
        <div
          className={cn(
            wellClass,
            "flex flex-col items-center gap-4 p-6 md:sticky md:top-24 md:col-start-2 md:row-span-2 md:row-start-1 md:self-start",
          )}
        >
          <div
            ref={qrRef}
            className="grid aspect-square w-full max-w-60 place-items-center overflow-hidden rounded-xl bg-white shadow-site-card"
          >
            {output ? (
              <>
                <span className="sr-only">{copy.qrCodeFor(output)}</span>
                <QRCodeCanvas
                  value={output}
                  size={QR_EXPORT_SIZE}
                  level={QR_LEVEL}
                  includeMargin
                  aria-hidden="true"
                  // The library sets width/height inline from `size`; override to fit the tile.
                  style={{ width: "100%", height: "auto" }}
                />
                {/* Source for the SVG download; same value, level and quiet zone as the PNG */}
                <div ref={svgRef} hidden>
                  <QRCodeSVG value={output} size={QR_EXPORT_SIZE} level={QR_LEVEL} includeMargin />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 px-6 text-center text-neutral-500">
                <IconQrcode aria-hidden="true" className="size-8" stroke={1.5} />
                <span className="text-sm">{copy.qrPlaceholder}</span>
              </div>
            )}
          </div>
          <div className="flex w-full max-w-60 flex-col gap-2">
            <button
              type="button"
              onClick={downloadPng}
              disabled={!output}
              className={cn(buttonClass({ variant: "secondary" }), touchTarget, "w-full gap-1.5")}
            >
              <IconDownload aria-hidden="true" className="size-4 shrink-0" />
              {copy.downloadPng}
            </button>
            <button
              type="button"
              onClick={downloadSvg}
              disabled={!output}
              className={cn(buttonClass({ variant: "secondary" }), touchTarget, "w-full gap-1.5")}
            >
              <IconDownload aria-hidden="true" className="size-4 shrink-0" />
              {copy.downloadSvg}
            </button>
          </div>
          <div className="w-full max-w-60 space-y-2 text-sm">
            <p className="text-neutral-600">{copy.scanHint}</p>
            {output && output.length > DENSE_QR_LENGTH && (
              <p className="flex items-start gap-1.5 text-amber-700">
                <IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {copy.denseCodeWarning}
              </p>
            )}
          </div>
        </div>

        {/* Upgrade path: directly under the QR downloads on mobile */}
        <div
          className={cn(wellClass, "p-5 md:col-start-1 md:row-start-2 md:m-6 md:mt-0 md:self-end")}
        >
          <h2 className={cn(h3Class, "text-lg")}>{copy.upgradeHeading}</h2>
          <p className={cn(bodyClass, "mt-2 sm:text-sm")}>
            {copy.upgradeBody(PLAN_CAPS.free.linksLimit ?? 0, FREE_QR_CODE_LIMIT)}
          </p>
          {/* Signed out, the link goes in a cookie set on click, not the href. No prefetch: the
              sign-up page reads that cookie when it renders, so it must load after the click. */}
          <ButtonLink
            href={getShortenHref(output, signedIn, campaign)}
            prefetch={false}
            onClick={() => {
              if (signedIn) return;
              document.cookie = serializeShortenIntentCookie(
                output,
                window.location.protocol === "https:",
              );
            }}
            className={cn("mt-4 whitespace-normal", touchTarget)}
          >
            {signedIn ? copy.shortenSignedIn : copy.shortenSignedOut}
          </ButtonLink>
          <p className="mt-3 text-sm text-neutral-600">
            {copy.pro.before}
            <Link
              href="/pricing"
              className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
            >
              {copy.pro.link}
            </Link>
            {copy.pro.after}
          </p>
          {copy.dashboardNote && (
            <p className="mt-3 text-sm text-neutral-600">{copy.dashboardNote}</p>
          )}
        </div>
      </div>
    </div>
  );
}

const ErrorText = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn("flex items-start gap-1.5 text-base text-red-600 sm:text-sm", className)}>
    <IconAlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
    {children}
  </p>
);

const CopyStatus = ({
  state,
  copied,
  fallback,
}: {
  state: CopyState;
  copied: string;
  fallback: string;
}) => (
  <p aria-live="polite" className={cn("text-sm text-neutral-600", state === "failed" && "mt-2")}>
    {state === "copied" && <span className="sr-only">{copied}</span>}
    {state === "failed" && fallback}
  </p>
);

"use client";

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconExternalLink,
} from "@tabler/icons-react";
import { useDeferredValue, useId, useMemo, useRef, useState } from "react";

import { serializeShortenIntentCookie } from "@/lib/auth/shorten-intent";
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
import { parseUrl } from "../_lib/parse-url";
import { useCopy } from "../_lib/use-copy";
import {
  buildBulk,
  buildTaggedUrl,
  cleanUtmValue,
  EMPTY_UTM_VALUES,
  getBulkSignupHref,
  getShortenHref,
  MAX_BULK_URLS,
  prepareUtmValue,
  readUtmParams,
  toCsv,
  UTM_FIELDS,
} from "./utils";

import type { CopyState } from "../_lib/use-copy";
import type { UtmField, UtmValues } from "./utils";
import type { ReactNode } from "react";

type Mode = "single" | "bulk";

const MAX_OUTPUT_LENGTH = 2000;
const MAX_LISTED_INVALID_LINES = 10;

const labelClass = "block text-base font-medium text-neutral-900 sm:text-sm";
const optionalClass = "font-normal text-neutral-600";
const hintClass = "mt-1.5 text-sm text-neutral-600";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

const FIELD_COPY = {
  source: {
    label: "Source",
    hint: "Where the traffic comes from, like newsletter or instagram",
    optional: false,
  },
  medium: {
    label: "Medium",
    hint: "The type of channel, like email, social or cpc",
    optional: false,
  },
  campaign: {
    label: "Campaign",
    hint: "The name of the promotion, like spring_sale",
    optional: false,
  },
  content: {
    label: "Content",
    hint: "Tells apart links in the same campaign, like header_button",
    optional: true,
  },
  term: { label: "Term", hint: "The paid search keyword", optional: true },
  id: { label: "Campaign ID", hint: "An ID you or your ad platform assigns", optional: true },
} satisfies Record<UtmField, { label: string; hint: string; optional?: boolean }>;

const PRESETS = [
  { label: "Newsletter", source: "newsletter", medium: "email" },
  { label: "Instagram", source: "instagram", medium: "social" },
  { label: "Facebook", source: "facebook", medium: "social" },
  { label: "LinkedIn", source: "linkedin", medium: "social" },
  { label: "X", source: "x", medium: "social" },
  { label: "TikTok", source: "tiktok", medium: "social" },
  { label: "Google Ads", source: "google", medium: "cpc" },
  { label: "QR code", source: "qr", medium: "print" },
] as const;

export function UtmBuilder() {
  const [mode, setMode] = useState<Mode>("single");
  const [url, setUrl] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [values, setValues] = useState<UtmValues>(EMPTY_UTM_VALUES);
  // Fields filled from tags in the pasted URL; they may be refilled as the URL changes, but a
  // field the visitor typed in never is.
  const [autoFilled, setAutoFilled] = useState<ReadonlySet<UtmField>>(new Set());
  const [foundTags, setFoundTags] = useState(false);
  const [clean, setClean] = useState(true);
  const signedIn = useSignedIn();

  const outputRef = useRef<HTMLTextAreaElement>(null);
  const bulkOutputRef = useRef<HTMLOListElement>(null);
  const id = useId();
  const ids = {
    url: `${id}-url`,
    urlMessage: `${id}-url-message`,
    bulk: `${id}-bulk`,
    bulkMessage: `${id}-bulk-message`,
    output: `${id}-output`,
    clean: `${id}-clean`,
  };

  const single = useCopy(() => outputRef.current?.select());
  const bulk = useCopy(() => {
    const list = bulkOutputRef.current;
    if (!list) return;
    const range = document.createRange();
    range.selectNodeContents(list);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });

  const setField = (field: UtmField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setAutoFilled((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
    single.reset();
    bulk.reset();
  };

  const onUrlChange = (next: string) => {
    setUrl(next);
    single.reset();
    const found = readUtmParams(next);
    const fillable = UTM_FIELDS.filter(
      (field) => found[field] && (values[field].trim() === "" || autoFilled.has(field)),
    );
    if (fillable.length === 0) {
      if (Object.keys(found).length === 0) setFoundTags(false);
      return;
    }
    setValues((prev) => {
      const filled = { ...prev };
      for (const field of fillable) filled[field] = found[field] ?? "";
      return filled;
    });
    setAutoFilled((prev) => new Set([...prev, ...fillable]));
    setFoundTags(true);
  };

  const applyPreset = (source: string, medium: string) => {
    setField("source", source);
    setField("medium", medium);
  };

  // One link: cheap enough to compute on every keystroke.
  const urlResult = parseUrl(url);
  const urlEmpty = url.trim() === "";
  const source = prepareUtmValue(values.source, clean);
  const medium = prepareUtmValue(values.medium, clean);
  const output = source ? buildTaggedUrl(url, values, clean) : null;

  // Many links: up to 1,000 lines, so let typing win over recomputing the list.
  const deferredBulkText = useDeferredValue(bulkText);
  const deferredValues = useDeferredValue(values);
  const deferredClean = useDeferredValue(clean);
  const bulkResult = useMemo(
    () =>
      mode === "bulk" &&
      deferredBulkText.trim() &&
      prepareUtmValue(deferredValues.source, deferredClean)
        ? buildBulk(deferredBulkText, deferredValues, deferredClean)
        : null,
    [mode, deferredBulkText, deferredValues, deferredClean],
  );
  const bulkError = mode === "bulk" && bulkResult?.ok === false ? bulkResult.error : null;
  const bulkLinks = bulkResult?.ok ? bulkResult.links : [];
  const invalidLines = bulkResult?.ok ? bulkResult.invalidLines : [];

  const cleaningChangedSomething =
    clean && UTM_FIELDS.some((field) => cleanUtmValue(values[field]) !== values[field].trim());
  const hasOutput = mode === "single" ? output !== null : bulkLinks.length > 0;

  const warnings: string[] = [];
  if (hasOutput) {
    if (!values.medium.trim() || !values.campaign.trim()) {
      warnings.push(
        "Add a medium and a campaign so GA4 groups this visit with the rest of the campaign.",
      );
    }
    if (UTM_FIELDS.some((field) => values[field].includes("@"))) {
      warnings.push(
        "This looks like an email address. Keep personal data out of UTM tags, because they end up in analytics reports and server logs.",
      );
    }
    if (mode === "single" && output && output.length > MAX_OUTPUT_LENGTH) {
      warnings.push(
        "This link is over 2,000 characters. Some apps cut long links off, so shorten it before you share it.",
      );
    }
  }

  const downloadCsv = () => {
    const blob = new Blob([toCsv(bulkLinks)], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "utm-links.csv";
    a.click();
    URL.revokeObjectURL(href);
  };

  const renderField = (field: UtmField) => {
    const copy = FIELD_COPY[field];
    const inputId = `${id}-${field}`;
    return (
      <div key={field}>
        <label htmlFor={inputId} className={labelClass}>
          {copy.label}
          {copy.optional && <span className={optionalClass}> (optional)</span>}
        </label>
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required={field === "source"}
          value={values[field]}
          onChange={(e) => setField(field, e.target.value)}
          aria-describedby={`${inputId}-hint`}
          className={fieldClass}
        />
        <p id={`${inputId}-hint`} className={hintClass}>
          {copy.hint}
        </p>
      </div>
    );
  };

  return (
    // The page promises typed URLs never leave the browser: keep them out of PostHog's
    // autocaptured events.
    <div className={cn(cardClass, "ph-no-capture mx-auto max-w-4xl p-2")}>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* Inputs */}
        <div className="flex min-w-0 flex-col gap-6 p-4 sm:p-6">
          <fieldset>
            <legend className="sr-only">How many links</legend>
            <div className="grid grid-cols-2 rounded-[10px] bg-neutral-950/[0.06] p-0.5 sm:inline-grid">
              {(
                [
                  ["single", "One link"],
                  ["bulk", "Many links"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={cn(
                    "relative cursor-pointer rounded-lg px-3.5 py-1.5 text-center text-base font-medium sm:text-sm",
                    "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900",
                    mode === value
                      ? "bg-white text-neutral-900 shadow-site-btn"
                      : "text-neutral-600 hover:text-neutral-900",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-mode`}
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {mode === "single" ? (
            <div>
              <label htmlFor={ids.url} className={labelClass}>
                Website URL
              </label>
              <input
                id={ids.url}
                type="url"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                required
                placeholder="https://example.com/landing-page"
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                aria-invalid={!urlResult.ok && !urlEmpty}
                aria-describedby={ids.urlMessage}
                className={fieldClass}
              />
              <div id={ids.urlMessage} aria-live="polite" className="mt-1.5">
                {!urlResult.ok && !urlEmpty ? (
                  <ErrorText>{urlResult.error}</ErrorText>
                ) : foundTags ? (
                  <p className={cn(hintClass, "mt-0")}>
                    We found UTM tags in this URL and filled them in below.
                  </p>
                ) : (
                  <p className={cn(hintClass, "mt-0")}>The page people should land on</p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor={ids.bulk} className={labelClass}>
                URLs, one per line
              </label>
              <textarea
                id={ids.bulk}
                rows={6}
                spellCheck={false}
                autoCapitalize="none"
                placeholder={"https://example.com/spring\nhttps://example.com/pricing"}
                value={bulkText}
                onChange={(e) => {
                  setBulkText(e.target.value);
                  bulk.reset();
                }}
                aria-invalid={bulkError !== null}
                aria-describedby={ids.bulkMessage}
                className={cn(fieldClass, "resize-y")}
              />
              <div id={ids.bulkMessage} aria-live="polite" className="mt-1.5">
                {bulkError ? (
                  <ErrorText>{bulkError}</ErrorText>
                ) : (
                  <p className={cn(hintClass, "mt-0")}>
                    Up to {MAX_BULK_URLS.toLocaleString()}. The tags below are added to every link.
                  </p>
                )}
              </div>
            </div>
          )}

          <fieldset>
            <legend className={labelClass}>Quick fill</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((preset) => {
                const active = source === preset.source && medium === preset.medium;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyPreset(preset.source, preset.medium)}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm font-medium",
                      focusRing,
                      active
                        ? "bg-neutral-900 text-white"
                        : "bg-white text-neutral-700 shadow-site-btn hover:bg-neutral-50 hover:text-neutral-900",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {(["source", "medium", "campaign", "content", "term"] as const).map(renderField)}

          <details className="group">
            <summary
              className={cn(
                "inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-base font-medium text-neutral-900 sm:text-sm [&::-webkit-details-marker]:hidden",
                focusRing,
              )}
            >
              More fields
              <IconChevronDown
                aria-hidden="true"
                className="size-4 text-neutral-600 group-open:rotate-180"
              />
            </summary>
            <div className="mt-4">{renderField("id")}</div>
          </details>

          <div>
            <div className="flex items-start gap-2">
              <input
                id={ids.clean}
                type="checkbox"
                checked={clean}
                onChange={(e) => setClean(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-neutral-900 sm:mt-px"
              />
              <label htmlFor={ids.clean} className="text-base text-neutral-900 sm:text-sm">
                Clean up values (lowercase, underscores for spaces)
              </label>
            </div>
            {cleaningChangedSomething && (
              <p className={cn(hintClass, "ml-6")}>
                Values are lowercased with underscores for spaces. GA4 treats Facebook and facebook
                as different sources.
              </p>
            )}
          </div>
        </div>

        {/* Output + shorten CTA, directly under the fields on mobile */}
        <div className="flex min-w-0 flex-col gap-2 md:sticky md:top-24 md:self-start">
          <div className={cn(wellClass, "p-4 sm:p-5")}>
            {mode === "single" ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor={ids.output} className={labelClass}>
                    Your campaign URL
                  </label>
                  {output && (
                    <span className="shrink-0 text-sm tabular-nums text-neutral-600">
                      {output.length.toLocaleString()}{" "}
                      {output.length === 1 ? "character" : "characters"}
                    </span>
                  )}
                </div>
                <textarea
                  ref={outputRef}
                  id={ids.output}
                  readOnly
                  rows={5}
                  value={output ?? ""}
                  placeholder="Add a URL and a source to see your campaign link."
                  className={cn(fieldClass, "resize-none break-all font-mono sm:text-sm")}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!output}
                    onClick={() => output && single.copy(output)}
                    className={cn(buttonClass({ variant: "primary" }), "gap-1.5")}
                  >
                    {single.state === "copied" ? (
                      <IconCheck aria-hidden="true" className="size-4 shrink-0" />
                    ) : (
                      <IconCopy aria-hidden="true" className="size-4 shrink-0" />
                    )}
                    {single.state === "copied" ? "Copied" : "Copy link"}
                  </button>
                  {output ? (
                    <a
                      href={output}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonClass({ variant: "secondary" }), "gap-1.5")}
                    >
                      <IconExternalLink aria-hidden="true" className="size-4 shrink-0" />
                      Test link
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className={cn(buttonClass({ variant: "secondary" }), "gap-1.5")}
                    >
                      <IconExternalLink aria-hidden="true" className="size-4 shrink-0" />
                      Test link
                    </button>
                  )}
                </div>
                <CopyStatus state={single.state} />
              </>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id={`${id}-bulk-output`} className={labelClass}>
                    Your campaign URLs
                  </h2>
                  {bulkLinks.length > 0 && (
                    <span
                      aria-live="polite"
                      className="shrink-0 text-sm tabular-nums text-neutral-600"
                    >
                      {bulkLinks.length.toLocaleString()}{" "}
                      {bulkLinks.length === 1 ? "link" : "links"} ready
                    </span>
                  )}
                </div>
                {bulkLinks.length > 0 ? (
                  <ol
                    ref={bulkOutputRef}
                    aria-labelledby={`${id}-bulk-output`}
                    className={cn(
                      "mt-2 h-48 divide-y divide-neutral-950/[0.07] overflow-y-auto rounded-[10px] bg-white px-3 shadow-site-btn",
                    )}
                  >
                    {bulkLinks.map((link, index) => (
                      // Lines can repeat, so the position is part of the key.
                      <li
                        key={`${index}-${link.url}`}
                        className="break-all py-2 font-mono text-sm text-neutral-900"
                      >
                        {link.url}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="mt-2 grid h-48 place-items-center rounded-[10px] bg-white px-6 text-center text-sm text-neutral-500 shadow-site-btn">
                    Add URLs and a source to see your campaign links.
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={bulkLinks.length === 0}
                    onClick={() => bulk.copy(bulkLinks.map((link) => link.url).join("\n"))}
                    className={cn(buttonClass({ variant: "primary" }), "gap-1.5")}
                  >
                    {bulk.state === "copied" ? (
                      <IconCheck aria-hidden="true" className="size-4 shrink-0" />
                    ) : (
                      <IconCopy aria-hidden="true" className="size-4 shrink-0" />
                    )}
                    {bulk.state === "copied" ? "Copied" : "Copy all"}
                  </button>
                  <button
                    type="button"
                    disabled={bulkLinks.length === 0}
                    onClick={downloadCsv}
                    className={cn(buttonClass({ variant: "secondary" }), "gap-1.5")}
                  >
                    <IconDownload aria-hidden="true" className="size-4 shrink-0" />
                    Download CSV
                  </button>
                </div>
                <CopyStatus state={bulk.state} />
                {invalidLines.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-neutral-600">
                    {invalidLines.slice(0, MAX_LISTED_INVALID_LINES).map((line) => (
                      <li key={line}>
                        Line {line.toLocaleString()} isn&apos;t a valid URL, so it was skipped.
                      </li>
                    ))}
                    {invalidLines.length > MAX_LISTED_INVALID_LINES && (
                      <li>
                        and {(invalidLines.length - MAX_LISTED_INVALID_LINES).toLocaleString()} more
                      </li>
                    )}
                  </ul>
                )}
              </>
            )}

            <div aria-live="polite">
              {warnings.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {warnings.map((warning) => (
                    <li key={warning} className="flex items-start gap-1.5 text-sm text-amber-700">
                      <IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className={cn(wellClass, "p-5")}>
            {mode === "single" ? (
              <>
                <h2 className={cn(h3Class, "text-lg")}>Long links get cut off and look messy</h2>
                <p className={cn(bodyClass, "mt-2 sm:text-sm")}>
                  Paste a tagged link into a post or a text and every tag shows. Shorten it with
                  iShortn and you get a short link that keeps every tag, plus clicks by day,
                  country, device and referrer. Free accounts get {PLAN_CAPS.free.linksLimit} links
                  a month.
                </p>
                {/* Signed out, the URL goes in a cookie set on click, not the href. No prefetch: the
                    sign-up page reads that cookie when it renders, so it must load after the click. */}
                <ButtonLink
                  href={getShortenHref(output, signedIn)}
                  prefetch={false}
                  onClick={() => {
                    if (signedIn) return;
                    document.cookie = serializeShortenIntentCookie(
                      output,
                      window.location.protocol === "https:",
                    );
                  }}
                  className="mt-4 whitespace-normal"
                >
                  {signedIn ? "Shorten this link" : "Shorten and track this link, free"}
                </ButtonLink>
              </>
            ) : (
              <>
                <h2 className={cn(h3Class, "text-lg")}>Shorten all of them at once</h2>
                <p className={cn(bodyClass, "mt-2 sm:text-sm")}>
                  The CSV has a url column, so it imports straight into iShortn. CSV import is on
                  the Pro plan and up, with up to {MAX_BULK_URLS.toLocaleString()} links per file.
                  You can also shorten links one at a time on the Free plan.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ButtonLink
                    href={getBulkSignupHref(signedIn)}
                    prefetch={false}
                    className="whitespace-normal"
                  >
                    {signedIn ? "Open your dashboard" : "Create a free account"}
                  </ButtonLink>
                  <ButtonLink variant="soft" href="/pricing">
                    View pricing
                  </ButtonLink>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const ErrorText = ({ children }: { children: ReactNode }) => (
  <p className="flex items-start gap-1.5 text-base text-red-600 sm:text-sm">
    <IconAlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
    {children}
  </p>
);

const CopyStatus = ({ state }: { state: CopyState }) => (
  <p aria-live="polite" className={cn("text-sm text-neutral-600", state === "failed" && "mt-2")}>
    {state === "copied" && <span className="sr-only">Copied</span>}
    {state === "failed" && "Press Ctrl+C or ⌘C to copy"}
  </p>
);

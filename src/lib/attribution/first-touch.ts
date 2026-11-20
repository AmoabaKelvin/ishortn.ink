// First-touch attribution: the marketing/auth pages write the `ish_ft` cookie on
// the visit that brought someone to iShortn, and the dashboard hands it to
// `attribution.record` once after signup. Shared by both sides, so no
// browser- or server-only imports here.

import { z } from "zod";

export const FIRST_TOUCH_COOKIE = "ish_ft";
export const FIRST_TOUCH_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;
export const FIRST_TOUCH_VALUE_MAX_LENGTH = 255;

export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

// Order is the tie-break when a URL carries more than one click ID.
export const CLICK_ID_PARAMS = [
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "rdt_cid",
  "fbclid",
  "li_fat_id",
] as const;

const TRACKED_PARAMS = [...UTM_PARAMS, ...CLICK_ID_PARAMS];

type TrackedParam = (typeof TRACKED_PARAMS)[number];
export type ClickIdType = (typeof CLICK_ID_PARAMS)[number];

export type FirstTouchCookie = Partial<Record<TrackedParam, string>> & {
  landingPath: string;
  referrerHost: string;
  ts: number;
};

export type FirstTouch = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  clickId: string | null;
  clickIdType: ClickIdType | null;
  landingPath: string | null;
  referrerHost: string | null;
  firstSeenAt: Date;
};

function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().slice(0, FIRST_TOUCH_VALUE_MAX_LENGTH);
  return trimmed === "" ? null : trimmed;
}

const AUTH_PATH = /^\/auth(\/|$)/;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// Registrable-domain match is approximated by suffix so that www., accounts.
// and the apex all count as same-site.
function isSameSite(a: string, b: string): boolean {
  const strip = (host: string) => host.replace(/^www\./, "");
  const x = strip(a);
  const y = strip(b);
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
}

/**
 * Builds the cookie payload for a page view, or null when there is nothing worth
 * recording (no tracked params, and no external referrer or an auth page).
 */
export function buildFirstTouch(input: {
  url: string;
  referrer: string;
  now: number;
}): FirstTouchCookie | null {
  const url = new URL(input.url);
  const params: Partial<Record<TrackedParam, string>> = {};
  for (const key of TRACKED_PARAMS) {
    const value = clean(url.searchParams.get(key));
    if (value) params[key] = value;
  }

  const referrer = hostOf(input.referrer);
  const referrerHost =
    referrer && !isSameSite(referrer, url.hostname.toLowerCase()) ? referrer : "";

  if (Object.keys(params).length === 0) {
    // Auth pages are reached back from OAuth providers (sso-callback) and webmail
    // verification links, so their referrer is not an acquisition source.
    if (!referrerHost || AUTH_PATH.test(url.pathname)) return null;
  }

  return {
    ...params,
    landingPath: url.pathname.slice(0, FIRST_TOUCH_VALUE_MAX_LENGTH),
    referrerHost: referrerHost.slice(0, FIRST_TOUCH_VALUE_MAX_LENGTH),
    ts: input.now,
  };
}

export function serializeFirstTouch(touch: FirstTouchCookie): string {
  return encodeURIComponent(JSON.stringify(touch));
}

// A field of the wrong type is dropped rather than failing the whole cookie.
const cookieString = z.string().optional().catch(undefined);

// z.object strips keys not listed here.
const firstTouchCookieSchema = z.object({
  utm_source: cookieString,
  utm_medium: cookieString,
  utm_campaign: cookieString,
  utm_term: cookieString,
  utm_content: cookieString,
  gclid: cookieString,
  gbraid: cookieString,
  wbraid: cookieString,
  msclkid: cookieString,
  rdt_cid: cookieString,
  fbclid: cookieString,
  li_fat_id: cookieString,
  landingPath: cookieString,
  referrerHost: cookieString,
  ts: z.number().optional().catch(undefined),
});

const firstTouchJson = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      ctx.addIssue({ code: "custom", message: "Malformed cookie" });
      return z.NEVER;
    }
  })
  .pipe(firstTouchCookieSchema);

/**
 * Parses an `ish_ft` cookie value (URL-encoded JSON) from an untrusted client.
 * Unknown keys are dropped, strings trimmed to 255 chars, and a missing or
 * implausible timestamp falls back to `now`. Returns null when the value is
 * malformed or carries nothing to attribute.
 */
export function parseFirstTouch(raw: string, now: Date): FirstTouch | null {
  const parsed = firstTouchJson.safeParse(raw);
  if (!parsed.success) return null;
  const record = parsed.data;

  let clickId: string | null = null;
  let clickIdType: ClickIdType | null = null;
  for (const key of CLICK_ID_PARAMS) {
    const value = clean(record[key]);
    if (value) {
      clickId = value;
      clickIdType = key;
      break;
    }
  }

  const landingPath = clean(record.landingPath);
  const maxAgeMs = FIRST_TOUCH_MAX_AGE_SECONDS * 1000;
  const ts = record.ts;
  const tsIsPlausible = ts !== undefined && ts <= now.getTime() && ts >= now.getTime() - maxAgeMs;

  const touch: FirstTouch = {
    utmSource: clean(record.utm_source),
    utmMedium: clean(record.utm_medium),
    utmCampaign: clean(record.utm_campaign),
    utmTerm: clean(record.utm_term),
    utmContent: clean(record.utm_content),
    clickId,
    clickIdType,
    landingPath: landingPath?.startsWith("/") ? landingPath : null,
    referrerHost: clean(record.referrerHost)?.toLowerCase() ?? null,
    firstSeenAt: tsIsPlausible ? new Date(ts) : now,
  };

  const hasSignal =
    touch.utmSource ??
    touch.utmMedium ??
    touch.utmCampaign ??
    touch.utmTerm ??
    touch.utmContent ??
    touch.clickId ??
    touch.referrerHost;
  return hasSignal ? touch : null;
}

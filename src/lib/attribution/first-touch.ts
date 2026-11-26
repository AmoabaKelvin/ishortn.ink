// First-touch attribution: the marketing/auth pages write the `ish_ft` cookie on
// the visit that brought someone to iShortn, and the dashboard hands it to
// `attribution.record` once after signup. Shared by both sides, so no
// browser- or server-only imports here. Parsing a cookie back lives in
// parse-first-touch.ts, so writing one doesn't ship zod to every marketing page.

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

// Exported for parse-first-touch.ts only; not part of the attribution API.
export function clean(value: string | null | undefined): string | null {
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
 * Builds the cookie payload for a page view. A visit with no tracked params and no
 * external referrer is still recorded (landing path only) so the signup counts as
 * direct rather than unknown.
 */
export function buildFirstTouch(input: {
  url: string;
  referrer: string;
  now: number;
}): FirstTouchCookie {
  const url = new URL(input.url);
  const params: Partial<Record<TrackedParam, string>> = {};
  for (const key of TRACKED_PARAMS) {
    const value = clean(url.searchParams.get(key));
    if (value) params[key] = value;
  }

  // Auth pages are reached back from OAuth providers (sso-callback) and webmail
  // verification links, so their referrer is not an acquisition source.
  const referrer = AUTH_PATH.test(url.pathname) ? "" : hostOf(input.referrer);
  const referrerHost =
    referrer && !isSameSite(referrer, url.hostname.toLowerCase()) ? referrer : "";

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

/** True when the visit carried no UTM, click ID or external referrer. */
export function isDirectTouch(touch: FirstTouch): boolean {
  return (
    !touch.utmSource &&
    !touch.utmMedium &&
    !touch.utmCampaign &&
    !touch.utmTerm &&
    !touch.utmContent &&
    !touch.clickId &&
    !touch.referrerHost
  );
}

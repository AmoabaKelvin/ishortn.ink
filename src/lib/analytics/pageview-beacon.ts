// Sends `$pageview`s straight to PostHog's capture endpoint when the visitor leaves before
// posthog-js has loaded. Content pages start posthog-js only on first interaction (or after a
// delay), so without this a visitor who reads and leaves would never be counted. Kept apart from
// posthog.ts so it can be tested without loading posthog-js.

export interface QueuedPageview {
  properties: Record<string, string | boolean>;
  timestamp: Date;
}

export interface BeaconIdentity {
  distinctId: string;
  deviceId: string;
  sessionId: string;
  /** Which ids posthog-js should adopt if it loads after a beacon went out. */
  bootstrap: { distinctId: boolean; sessionId: boolean };
}

export interface BeaconContext {
  title: string;
  /** location.search */
  search: string;
  referrer: string;
  userAgent: string;
  screen: { width: number; height: number };
  viewport: { width: number; height: number };
}

// posthog-js defaults (session_idle_timeout_seconds, and its 24 h session cap).
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_MAX_MS = 24 * 60 * 60 * 1000;

// The campaign properties posthog-js adds to every event; web analytics derives channels from them.
const CAMPAIGN_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gad_source",
  "fbclid",
  "msclkid",
  "twclid",
  "li_fat_id",
];

// posthog-js drops events from bots and automation by user agent; beacons have to as well. A short
// list of what reaches pages that run JavaScript (search renderers, link previews, audits).
const BOT_USER_AGENT =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|google-inspectiontool|phantomjs|puppeteer|playwright|python|curl|wget/i;

/** Whether a beacon should be skipped for this browser, as posthog-js would drop its events. */
export function isLikelyBot(userAgent: string, webdriver: boolean) {
  return webdriver || BOT_USER_AGENT.test(userAgent);
}

/** posthog-js's persistence key for a project token (`parseName` in posthog-persistence). */
export function postHogPersistenceName(token: string) {
  return `ph_${token.replace(/\+/g, "PL").replace(/\//g, "SL").replace(/=/g, "EQ")}_posthog`;
}

function readCookie(cookie: string, name: string) {
  const prefix = `${name}=`;
  for (const pair of cookie.split(";")) {
    const trimmed = pair.trim();
    if (!trimmed.startsWith(prefix)) continue;
    try {
      return decodeURIComponent(trimmed.slice(prefix.length));
    } catch {
      return null;
    }
  }
  return null;
}

// posthog-js stores its persistence as compact JSON (JSON.stringify). Only these fields are needed,
// so they are matched directly rather than parsing the whole object.
const STORED_DISTINCT_ID = /"distinct_id":"([^"\\]+)"/;
const STORED_DEVICE_ID = /"\$device_id":"([^"\\]+)"/;
const STORED_SESSION = /"\$sesid":\[(\d+),"([^"\\]+)",(\d+)\]/;

function activeSessionId(stored: string, now: number) {
  const match = STORED_SESSION.exec(stored);
  if (!match?.[2]) return null;
  const lastActivity = Number(match[1]);
  const startedAt = Number(match[3]);
  if (now - lastActivity > SESSION_IDLE_MS || now - startedAt > SESSION_MAX_MS) return null;
  return match[2];
}

/** A UUIDv7, the id format posthog-js uses for anonymous ids, sessions and events. */
export function uuidv7(now = Date.now()) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let time = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The visitor's PostHog distinct id and session from posthog-js's persistence (the cookie, then
 * localStorage), so beaconed page views join the visitor's history. Missing or expired values are
 * generated. posthog.ts bootstraps posthog-js with generated ids if it loads later on the same page,
 * but a distinct id only when nothing was stored: bootstrapping one replaces the stored identity.
 */
export function resolveBeaconIdentity(
  token: string,
  cookie: string,
  localStorageValue: string | null,
  now = Date.now(),
): BeaconIdentity {
  const stored = readCookie(cookie, postHogPersistenceName(token)) || localStorageValue || "";
  const storedDistinctId = STORED_DISTINCT_ID.exec(stored)?.[1] ?? null;
  const storedSessionId = activeSessionId(stored, now);
  // An anonymous visitor's device id is their first distinct id, as posthog-js sets it.
  const distinctId = storedDistinctId ?? uuidv7(now);
  return {
    distinctId,
    deviceId: (storedDistinctId && STORED_DEVICE_ID.exec(stored)?.[1]) || distinctId,
    sessionId: storedSessionId ?? uuidv7(now),
    bootstrap: { distinctId: stored === "", sessionId: !storedSessionId },
  };
}

function referringDomain(referrer: string) {
  if (!referrer) return "$direct";
  try {
    return new URL(referrer).host;
  } catch {
    return "$direct";
  }
}

// Read from the current URL at send time, as posthog-js does for each event it captures.
function campaignProperties(search: string) {
  const params = new URLSearchParams(search);
  const found: Record<string, string> = {};
  for (const key of CAMPAIGN_PARAMS) {
    const value = params.get(key);
    if (value) found[key] = value;
  }
  return found;
}

/**
 * The capture request body for `pageviews`: a base64 JSON batch, which PostHog's `/i/v0/e/`
 * accepts as text/plain (with `?compression=base64`), so sendBeacon needs no CORS preflight.
 */
export function buildBeaconBody(
  token: string,
  identity: BeaconIdentity,
  pageviews: QueuedPageview[],
  context: BeaconContext,
) {
  const batch = pageviews.map(({ properties, timestamp }) => ({
    event: "$pageview",
    uuid: uuidv7(timestamp.getTime()),
    timestamp: timestamp.toISOString(),
    properties: {
      ...campaignProperties(context.search),
      ...properties,
      token,
      distinct_id: identity.distinctId,
      $device_id: identity.deviceId,
      $session_id: identity.sessionId,
      $process_person_profile: true,
      $lib: "web",
      $title: context.title,
      $referrer: context.referrer || "$direct",
      $referring_domain: referringDomain(context.referrer),
      $raw_user_agent: context.userAgent,
      $screen_width: context.screen.width,
      $screen_height: context.screen.height,
      $viewport_width: context.viewport.width,
      $viewport_height: context.viewport.height,
      $pageview_beacon: true,
    },
  }));
  const bytes = new TextEncoder().encode(JSON.stringify(batch));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

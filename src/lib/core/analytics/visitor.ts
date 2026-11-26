import { UAParser } from "ua-parser-js";

import { getContinentName, getCountryFullName } from "@/lib/countries";
import { resolveDeviceType } from "@/lib/utils/device-type";
import { hashIp } from "@/lib/utils/ip-hash";
import { isBot } from "@/lib/utils/is-bot";
import { lookup } from "@/lib/utils/lookup";

import { baseDomain } from "./referrer";

import type { Visitor } from "./click-event";

// Shared visitor-fingerprinting helpers used by every analytics recorder
// (link clicks, bio-page views). Keeping these in one place stops the click
// and view pipelines from drifting apart.

const isLocalhost = process.env.NODE_ENV === "development";

export type DeviceDetails = {
  browser: string;
  os: string;
  device: string;
  model: string;
};

/** Parse device/browser/OS details from request headers (UA + client hints). */
export async function parseDeviceDetails(headers: Headers): Promise<DeviceDetails> {
  const userAgent = headers.get("user-agent") ?? "";
  const parsed = await UAParser(userAgent, headers).withClientHints();
  const osName = parsed.os.name ?? "Unknown";
  return {
    browser: parsed.browser.name ?? "Unknown",
    os: osName,
    device: resolveDeviceType(osName, parsed.device.type),
    model: parsed.device.model ?? "Unknown",
  };
}

/** Resolve full country/continent/city names from raw geo codes. */
export function resolveGeo(country: string, city: string) {
  if (isLocalhost) {
    return {
      countryName: "United States",
      continentName: "North America",
      cityName: "San Francisco",
    };
  }

  if (!country || country === "undefined" || country === "Unknown") {
    return { countryName: "Unknown", continentName: "Unknown", cityName: "Unknown" };
  }

  try {
    return {
      countryName: getCountryFullName(country) ?? "Unknown",
      continentName: getContinentName(country) ?? "Unknown",
      cityName: city && city !== "undefined" && city !== "Unknown" ? city : "Unknown",
    };
  } catch {
    return { countryName: "Unknown", continentName: "Unknown", cityName: "Unknown" };
  }
}

const REFERRER_SOURCES = {
  "t.co": "twitter",
  "l.facebook.com": "facebook",
  "lm.facebook.com": "facebook",
  "m.facebook.com": "facebook",
  "linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  "out.reddit.com": "reddit",
  "away.vk.com": "vkontakte",
  "com.google.android.gm": "gmail",
};

/** Normalize a referer header into a coarse source label. */
export function parseReferrer(referrer: string | null): string {
  if (!referrer) return "direct";

  try {
    const url = new URL(referrer);
    const hostname = url.hostname.replace(/^www\./, "");

    const source = lookup(REFERRER_SOURCES, hostname);
    if (source) return source;

    return baseDomain(hostname);
  } catch {
    return "unknown";
  }
}

// In-app browser names as ua-parser-js reports them, mapped to source labels.
// "GSA" (the Google app) is left out: it opens links from search, Discover and
// chats alike, so it says nothing about the source.
const IN_APP_BROWSER_SOURCES = {
  Facebook: "facebook", // Messenger reports as Facebook too
  Instagram: "instagram",
  TikTok: "tiktok",
  Snapchat: "snapchat",
  LinkedIn: "linkedin",
  Twitter: "x",
  WeChat: "wechat",
  Line: "line",
};

// Apps ua-parser-js doesn't name (it reports their WebView). Threads identifies
// itself by its codename, Barcelona.
const IN_APP_UA_TOKENS: [RegExp, string][] = [
  [/\bBarcelona [\d.]+/, "threads"],
  [/\bPinterest\//i, "pinterest"],
  [/\bTelegram-(?:Android|iOS)\//i, "telegram"],
];

/** Source label of a known in-app browser, from the parsed browser name or the raw UA. */
export function inAppSource(browser: string, userAgent: string): string | null {
  for (const [token, source] of IN_APP_UA_TOKENS) {
    if (token.test(userAgent)) return source;
  }
  return lookup(IN_APP_BROWSER_SOURCES, browser) ?? null;
}

/**
 * Source label for an event. A referrer always wins; without one, an in-app
 * browser names the app, and a QR code's tracking link means a scan.
 */
export function inferSource(opts: {
  referrer: string | null;
  browser: string;
  userAgent: string;
  isQrCode?: boolean | null;
}): string {
  if (opts.referrer) return parseReferrer(opts.referrer);
  return inAppSource(opts.browser, opts.userAgent) ?? (opts.isQrCode ? "qr" : "direct");
}

/**
 * The referrer, or null when it is empty or points at `ownHost` (reloads and
 * in-page navigation are direct visits, not a source).
 */
export function externalReferrer(
  referrer: string | null | undefined,
  ownHost: string | null,
): string | null {
  if (!referrer) return null;
  const bare = (host: string) =>
    host
      .split(":")[0]!
      .toLowerCase()
      .replace(/^www\./, "");
  try {
    if (ownHost && bare(new URL(referrer).hostname) === bare(ownHost)) return null;
  } catch {
    // Unparseable: parseReferrer records it as "unknown".
  }
  return referrer;
}

/** Visitor fields for a click or view event; null for bots. */
export async function describeVisitor(opts: {
  headers: Headers;
  ip: string;
  country: string;
  city: string;
  /** Replaces the request's Referer header when the caller knows the real source. */
  referrer?: string | null;
  /** The event is a click on a QR code's tracking link. */
  isQrCode?: boolean | null;
}): Promise<Visitor | null> {
  const { headers, ip, country, city, isQrCode, referrer = headers.get("referer") } = opts;
  const userAgent = headers.get("user-agent") ?? "";
  if (userAgent && isBot(userAgent)) return null;

  const deviceDetails = await parseDeviceDetails(headers);
  const { countryName, continentName, cityName } = resolveGeo(country, city);

  return {
    ipHash: hashIp(ip && ip !== "undefined" ? ip : "localhost-dev"),
    ...deviceDetails,
    referer: inferSource({ referrer, browser: deviceDetails.browser, userAgent, isQrCode }),
    country: countryName,
    city: cityName,
    continent: continentName,
    occurredAt: new Date().toISOString(),
  };
}

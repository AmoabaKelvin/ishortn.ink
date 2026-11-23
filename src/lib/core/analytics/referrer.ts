import { lookup } from "@/lib/utils/lookup";

// Referrers are stored as coarse source labels (`parseReferrer` in visitor.ts):
// a known-source name ("twitter", "facebook", "direct"), or the registrable
// domain of any other host ("instagram.com", "google.co.uk"). Older rows may
// hold "null" or a full URL. These helpers read all of them; they are pure so
// both the click pipeline and client components can import them.

// Second-level labels used under two-letter country TLDs (google.co.uk,
// news.com.au, yahoo.co.jp), where the registrable domain has three labels.
const COUNTRY_SECOND_LEVEL = new Set(["co", "com", "net", "org", "gov", "edu", "ac", "ne", "or"]);

/** Registrable domain of a hostname: `news.google.co.uk` → `google.co.uk`. */
export function baseDomain(hostname: string): string {
  const parts = hostname.split(".");
  const tld = parts.at(-1) ?? "";
  const keep =
    parts.length >= 3 && tld.length === 2 && COUNTRY_SECOND_LEVEL.has(parts.at(-2) ?? "") ? 3 : 2;
  return parts.slice(-keep).join(".");
}

// One platform reaches us under several names: older rows hold the source label
// ("twitter"), the registrable domain ("twitter.com", "x.com") or a full URL from
// a redirector host ("l.facebook.com"). Each maps to one canonical source.
const SOURCE_ALIASES = {
  twitter: "x",
  "twitter.com": "x",
  "x.com": "x",
  "t.co": "x",
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "fb.me": "facebook",
  "instagram.com": "instagram",
  "linkedin.com": "linkedin",
  "lnkd.in": "linkedin",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "reddit.com": "reddit",
  "redd.it": "reddit",
  "whatsapp.com": "whatsapp",
  "whatsapp.net": "whatsapp",
  "wa.me": "whatsapp",
  // Android app referrers (android-app://com.facebook.katana), stored by registrable domain.
  "facebook.katana": "facebook",
  "instagram.android": "instagram",
  "twitter.android": "x",
  "linkedin.android": "linkedin",
  "reddit.frontpage": "reddit",
  "com.whatsapp": "whatsapp",
};

/**
 * Canonical source for a referrer source label or hostname: known aliases of a
 * platform collapse to one name ("t.co", "x.com" → "x"), Google's country
 * domains included. Anything else is returned unchanged.
 */
export function canonicalReferrer(source: string): string {
  const value = source.toLowerCase();
  const exact = lookup(SOURCE_ALIASES, value);
  if (exact) return exact;
  if (!value.includes(".")) return value;
  const base = baseDomain(value);
  if (base.split(".")[0] === "google") return "google";
  return lookup(SOURCE_ALIASES, base) ?? value;
}

/** Canonical source key for a stored referrer value. */
export function normalizeReferrer(stored: string): string {
  if (!stored || stored === "null") return "direct";
  try {
    return canonicalReferrer(new URL(stored).hostname.replace(/^www\./, ""));
  } catch {
    return canonicalReferrer(stored);
  }
}

const SOURCE_LABELS = {
  direct: "Direct",
  x: "X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  vkontakte: "VK",
};

/** Display label: source names are title-cased, domains are shown as-is. */
export function formatReferrerLabel(stored: string): string {
  const source = normalizeReferrer(stored);
  if (source.includes(".")) return source;
  return lookup(SOURCE_LABELS, source) ?? source.charAt(0).toUpperCase() + source.slice(1);
}

const SOCIAL_SOURCES = new Set([
  "x",
  "facebook",
  "instagram",
  "linkedin",
  "reddit",
  "youtube",
  "vkontakte",
  "pinterest.com",
  "tiktok.com",
  "threads.net",
  "bsky.app",
]);

const SEARCH_ENGINES = new Set([
  "google",
  "bing",
  "yahoo",
  "duckduckgo",
  "baidu",
  "yandex",
  "ecosia",
]);

export function isSocialReferrer(stored: string): boolean {
  return SOCIAL_SOURCES.has(normalizeReferrer(stored));
}

export function isSearchReferrer(stored: string): boolean {
  const source = normalizeReferrer(stored);
  if (source === "google") return true;
  return source.includes(".") && SEARCH_ENGINES.has(baseDomain(source).split(".")[0] ?? "");
}

export type ReferrerRow = { source: string; name: string; clicks: number };

/** Merge stored referrer counts into one row per source ("null" and "direct" are both Direct). */
export function groupReferrers(referers: Record<string, number>): ReferrerRow[] {
  const rows = new Map<string, ReferrerRow>();
  for (const [stored, clicks] of Object.entries(referers)) {
    const source = normalizeReferrer(stored);
    const row = rows.get(source);
    if (row) row.clicks += Number(clicks);
    else rows.set(source, { source, name: formatReferrerLabel(stored), clicks: Number(clicks) });
  }
  return [...rows.values()];
}

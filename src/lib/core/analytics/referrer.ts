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

/** Canonical source key for a stored referrer value. */
export function normalizeReferrer(stored: string): string {
  if (!stored || stored === "null") return "direct";
  try {
    return new URL(stored).hostname.replace(/^www\./, "");
  } catch {
    return stored.toLowerCase();
  }
}

const SOURCE_LABELS = {
  direct: "Direct",
  linkedin: "LinkedIn",
  vkontakte: "VK",
};

/** Display label: source names are title-cased, domains are shown as-is. */
export function formatReferrerLabel(stored: string): string {
  const source = normalizeReferrer(stored);
  if (source.includes(".")) return source;
  return lookup(SOURCE_LABELS, source) ?? source.charAt(0).toUpperCase() + source.slice(1);
}

const SOCIAL_SOURCES = new Set([
  "twitter",
  "facebook",
  "linkedin",
  "reddit",
  "vkontakte",
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "reddit.com",
  "pinterest.com",
  "youtube.com",
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

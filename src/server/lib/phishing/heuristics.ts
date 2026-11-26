import { getSubdomain } from "tldts";

type HeuristicResult = { blocked: boolean; reason: string };

export const INVALID_URL_REASON = "Invalid URL format";

const SUSPICIOUS_TLDS = [".tk", ".ml", ".ga", ".cf", ".gq"];

// Subdomain levels allowed below the registrable domain (eTLD+1) before the URL is suspicious.
const MAX_SUBDOMAIN_LEVELS = 3;

// Storage and CDN hosts that generate deep, random-looking hostnames for legitimate files.
// Only the depth rule is skipped; the remaining checks still apply.
const DEEP_HOST_ALLOWLIST = [
  "rackcdn.com",
  "amazonaws.com",
  "blob.core.windows.net",
  "cloudfront.net",
  "googleusercontent.com",
  "storage.googleapis.com",
  "r2.dev",
];

function isDeepHostAllowed(hostname: string): boolean {
  return DEEP_HOST_ALLOWLIST.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

const BRAND_NAMES = [
  "google",
  "paypal",
  "apple",
  "microsoft",
  "amazon",
  "facebook",
  "instagram",
  "netflix",
  "linkedin",
  "twitter",
  "dropbox",
  "chase",
  "wellsfargo",
  "bankofamerica",
  "citibank",
] as const;

// Common character substitutions used in homoglyph attacks
const HOMOGLYPH_MAP = new Map([
  ["0", "o"],
  ["1", "l"],
  ["!", "i"],
  ["@", "a"],
  ["$", "s"],
  ["3", "e"],
  ["4", "a"],
  ["5", "s"],
  ["7", "t"],
  ["8", "b"],
  ["|", "l"],
  ["¡", "i"],
  // Cyrillic lookalikes
  ["\u0430", "a"], // а
  ["\u0435", "e"], // е
  ["\u043E", "o"], // о
  ["\u0440", "p"], // р
  ["\u0441", "c"], // с
  ["\u0443", "y"], // у
  ["\u0445", "x"], // х
]);

function normalizeHomoglyphs(str: string): string {
  let result = "";
  for (const char of str) {
    result += HOMOGLYPH_MAP.get(char) ?? char;
  }
  return result.toLowerCase();
}

function extractSecondLevelDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length < 2) return hostname;
  // Return the second-level domain (e.g., "example" from "sub.example.com")
  return parts[parts.length - 2]!;
}

function checkHomoglyphs(hostname: string): string | null {
  const sld = extractSecondLevelDomain(hostname);
  const normalized = normalizeHomoglyphs(sld);

  for (const brand of BRAND_NAMES) {
    // Skip if it's exactly the brand (legitimate)
    if (sld === brand) continue;

    // Flag if the normalized form matches the brand but the raw form doesn't
    if (normalized === brand) {
      return `Domain "${sld}" appears to impersonate "${brand}" using character substitutions`;
    }

    // Check for very close misspellings (1 char difference) of the brand name
    // Only for domains that are the same length as the brand
    if (sld.length === brand.length && sld !== brand) {
      let differences = 0;
      for (let i = 0; i < sld.length; i++) {
        if (sld[i] !== brand[i]) differences++;
      }
      if (differences === 1) {
        return `Domain "${sld}" closely resembles "${brand}" (possible typosquatting)`;
      }
    }
  }

  return null;
}

export function runHeuristicChecks(url: string): HeuristicResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { blocked: true, reason: INVALID_URL_REASON };
  }

  const hostname = parsed.hostname;

  // 1. IP address as hostname
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return {
      blocked: true,
      reason: "URL uses an IP address instead of a domain name",
    };
  }

  // IPv6
  if (hostname.startsWith("[")) {
    return {
      blocked: true,
      reason: "URL uses an IPv6 address instead of a domain name",
    };
  }

  // 2. @ symbol before hostname (credential stuffing pattern)
  // In a URL like http://legitimate.com@evil.com, the browser actually goes to evil.com
  const beforePath = url.split("/").slice(0, 3).join("/");
  if (beforePath.includes("@")) {
    return {
      blocked: true,
      reason: 'URL contains "@" symbol which can be used to disguise the real destination',
    };
  }

  // 3. Excessive subdomains, counted below the registrable domain so hosts under two-part
  // suffixes (shop.example.co.uk) aren't penalised for the suffix itself
  const subdomain = getSubdomain(hostname) ?? "";
  const subdomainLevels = subdomain ? subdomain.split(".").length : 0;
  if (subdomainLevels > MAX_SUBDOMAIN_LEVELS && !isDeepHostAllowed(hostname)) {
    return {
      blocked: true,
      reason: `URL has ${subdomainLevels} subdomain levels, which is suspicious`,
    };
  }

  // 4. Suspicious TLDs
  const parts = hostname.split(".");
  const tld = "." + parts[parts.length - 1];
  if (SUSPICIOUS_TLDS.includes(tld!)) {
    return {
      blocked: true,
      reason: `URL uses suspicious top-level domain "${tld}"`,
    };
  }

  // 5. Extremely long domain
  if (hostname.length > 100) {
    return {
      blocked: true,
      reason: "Domain name is suspiciously long",
    };
  }

  // 6. Homoglyph / typosquatting detection
  const homoglyphResult = checkHomoglyphs(hostname);
  if (homoglyphResult) {
    return { blocked: true, reason: homoglyphResult };
  }

  return { blocked: false, reason: "" };
}

// Open redirectors phishing mail wraps its links in, so the sender's own domain is what the
// victim's mail filter sees. Paths are matched as prefixes.
export const OPEN_REDIRECTORS: { host: RegExp; paths: string[] }[] = [
  {
    host: /^(www\.)?google\.(com?\.)?[a-z]{2,3}$/,
    paths: ["/url", "/amp/", "/aclk", "/interstitial"],
  },
  { host: /^(www\.)?bing\.com$/, paths: ["/ck/"] },
  { host: /^(www\.)?duckduckgo\.com$/, paths: ["/l/"] },
  { host: /^((l|lm|m|www)\.)?facebook\.com$/, paths: ["/l.php"] },
  { host: /^l\.instagram\.com$/, paths: ["/"] },
  { host: /^(www\.|m\.)?youtube\.com$/, paths: ["/redirect"] },
  { host: /^(www\.)?linkedin\.com$/, paths: ["/redir/"] },
  { host: /^slack-redir\.net$/, paths: ["/link"] },
];

// A whole parameter value (`=` or `#` before it, `&`, `#` or the end after it) that is an email,
// so tokens and URLs that merely contain an `@` don't count. Two-character minimums skip
// email-shaped tokens like `x@y.co`.
const EMAIL_VALUE_PATTERN =
  /[=#]([a-z0-9._%+-]{2,}@[a-z0-9-]{2,}(?:\.[a-z0-9-]+)*\.[a-z]{2,})(?=$|[&#])/i;

/** Whether the URL points at an open-redirect endpoint listed in `OPEN_REDIRECTORS`. */
export function isOpenRedirect(parsed: URL): boolean {
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  return OPEN_REDIRECTORS.some(
    (r) => r.host.test(host) && r.paths.some((prefix) => path.startsWith(prefix)),
  );
}

function decodeRepeatedly(value: string): string {
  // Nested redirects encode the target URL (and the email in it) once per hop.
  let decoded = value;
  for (let i = 0; i < 3; i++) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return decoded;
    }
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

/**
 * The email address carried in the query or fragment of an open-redirect URL
 * (`google.com/url?q=...#x=jane@acme.com`), a tell of phishing aimed at one recipient. Null for
 * any other URL.
 */
export function findEmailInRedirect(url: string): string | null {
  // Cheap pre-check: most URLs carry no email at all, so they skip the parse.
  if (!url.includes("@") && !/%(25)*40/i.test(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!isOpenRedirect(parsed)) return null;
  return EMAIL_VALUE_PATTERN.exec(decodeRepeatedly(`${parsed.search}${parsed.hash}`))?.[1] ?? null;
}

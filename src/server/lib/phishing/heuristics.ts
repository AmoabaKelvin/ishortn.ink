type HeuristicResult = { blocked: boolean; reason: string };

const SUSPICIOUS_TLDS = [".tk", ".ml", ".ga", ".cf", ".gq"];

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
const HOMOGLYPH_MAP: Record<string, string> = {
  "0": "o",
  "1": "l",
  "!": "i",
  "@": "a",
  "$": "s",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "|": "l",
  "¡": "i",
  // Cyrillic lookalikes
  "\u0430": "a", // а
  "\u0435": "e", // е
  "\u043E": "o", // о
  "\u0440": "p", // р
  "\u0441": "c", // с
  "\u0443": "y", // у
  "\u0445": "x", // х
};

function normalizeHomoglyphs(str: string): string {
  let result = "";
  for (const char of str) {
    result += HOMOGLYPH_MAP[char] ?? char;
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
    return { blocked: true, reason: "Invalid URL format" };
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

  // 3. Excessive subdomains (more than 3 levels total, e.g., a.b.c.d.com)
  const parts = hostname.split(".");
  if (parts.length > 4) {
    return {
      blocked: true,
      reason: `URL has ${parts.length - 1} subdomain levels, which is suspicious`,
    };
  }

  // 4. Suspicious TLDs
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

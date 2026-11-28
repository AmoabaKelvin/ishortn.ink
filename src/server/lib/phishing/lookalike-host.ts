import { getDomain } from "tldts";

/**
 * Card, bank and payment brands a recurring phishing group impersonates on throwaway hosts
 * (`internationalcard.servicebericht.org`, `itsme-id.service-online.im`), and the registrable
 * domains each brand actually uses.
 */
const OFFICIAL_DOMAINS: ReadonlySet<string> = new Set([
  "icscards.nl",
  "itsme-id.com",
  "sumup.com",
  "paylife.at",
  "belastingdienst.nl",
  "fluvius.be",
  "bitvavo.com",
  "ing.nl",
  "ing.com",
  "ing.be",
  "ing.de",
  "rabobank.nl",
  "rabobank.com",
  "abnamro.nl",
  "abnamro.com",
  "bunq.com",
  "americanexpress.com",
]);

// Distinctive enough to flag on their own anywhere in the host.
const BRAND_TOKENS = [
  "icscards",
  "lcscards",
  "internationalcard",
  "lnternationalcard",
  "itsme",
  "sumup",
  "paylife",
  "belastingdienst",
  "fluvius",
  "bitvavo",
  "rabobank",
  "abnamro",
  "bunq",
  "americanexpress",
  "american-express",
];

// Also common abbreviations (ics.uci.edu, industrial control systems, school districts), so they
// only count next to a service-portal word.
const SHORT_BRAND_TOKENS = ["ics", "lcs", "ing"];

const PORTAL_WORDS = [
  "serviceportaal",
  "servicesportal",
  "service-portal",
  "servicebericht",
  "doorsturen",
  "beschikking",
  "authenticeren",
  "-redirect",
];

// A token must be a whole label or a hyphen-separated part of one, so "physics", "singapore" and
// "ingredients" never match.
const tokenPattern = (tokens: string[]) => new RegExp(`(?:^|-)(${tokens.join("|")})(?:-|$)`);
const BRAND_PATTERN = tokenPattern(BRAND_TOKENS);
const ANY_BRAND_PATTERN = tokenPattern([...BRAND_TOKENS, ...SHORT_BRAND_TOKENS]);

function matchLabel(labels: string[], pattern: RegExp): string | null {
  for (const label of labels) {
    const match = pattern.exec(label);
    if (match) return match[1]!;
  }
  return null;
}

/**
 * The brand a hostname impersonates, or null. A host is a lookalike when a protected brand token
 * is one of its labels (or a hyphen-separated part of one) while its registrable domain is not
 * one of the brand domains, or when it pairs any brand token, short ones included, with a
 * service-portal word. Pure string work: no lookups.
 */
export function findLookalikeBrand(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const domain = getDomain(host);
  if (domain && OFFICIAL_DOMAINS.has(domain)) return null;

  const labels = host.split(".");
  const brand = matchLabel(labels, BRAND_PATTERN);
  if (brand) return brand;
  if (!PORTAL_WORDS.some((word) => host.includes(word))) return null;
  return matchLabel(labels, ANY_BRAND_PATTERN);
}

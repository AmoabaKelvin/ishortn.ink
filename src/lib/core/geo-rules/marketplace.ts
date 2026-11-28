import { normalizeDestinationUrl } from "@/lib/utils/destination-url";

export type AmazonStorefront = {
  domain: string;
  label: string;
  // Countries sent to this store; neighbours without their own Amazon store ride along.
  countries: string[];
};

// Ordered by priority: when the plan's rule limit is reached, the first stores win.
export const AMAZON_STOREFRONTS: AmazonStorefront[] = [
  { domain: "amazon.com", label: "Amazon US", countries: ["US"] },
  { domain: "amazon.co.uk", label: "Amazon UK", countries: ["GB", "IE"] },
  { domain: "amazon.de", label: "Amazon Germany", countries: ["DE", "AT", "CH"] },
  { domain: "amazon.ca", label: "Amazon Canada", countries: ["CA"] },
  { domain: "amazon.fr", label: "Amazon France", countries: ["FR", "BE"] },
  { domain: "amazon.it", label: "Amazon Italy", countries: ["IT"] },
  { domain: "amazon.es", label: "Amazon Spain", countries: ["ES"] },
  { domain: "amazon.in", label: "Amazon India", countries: ["IN"] },
  { domain: "amazon.com.au", label: "Amazon Australia", countries: ["AU", "NZ"] },
];

// Associate tags belong to one marketplace, so they are dropped from the other stores' URLs.
const STORE_SPECIFIC_PARAMS = ["tag"];

export type ParsedAmazonUrl = {
  storefront: AmazonStorefront;
  // Path, query and hash to reuse on the other storefronts.
  pathAndQuery: string;
};

export function parseAmazonUrl(input: string): ParsedAmazonUrl | null {
  const normalized = normalizeDestinationUrl(input);
  if (!normalized) return null;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^(www|smile)\./, "");
  const storefront = AMAZON_STOREFRONTS.find((store) => store.domain === host);
  if (!storefront) return null;

  // A bare storefront home page has no product to map.
  if (url.pathname === "/" || url.pathname === "") return null;

  for (const param of STORE_SPECIFIC_PARAMS) url.searchParams.delete(param);

  return { storefront, pathAndQuery: `${url.pathname}${url.search}${url.hash}` };
}

export type MarketplaceRule = {
  storefront: string;
  type: "country";
  condition: "in";
  values: string[];
  action: "redirect";
  destination: string;
};

/**
 * Proposes one country rule per other Amazon storefront, pointing at the same product path.
 * Stores whose countries are already targeted by an existing rule are skipped, and at most
 * `maxRules` rules are returned (undefined means no limit).
 */
export function buildAmazonStorefrontRules(
  input: string,
  options: { existingCountries?: Iterable<string>; maxRules?: number } = {},
): MarketplaceRule[] {
  const parsed = parseAmazonUrl(input);
  if (!parsed) return [];

  const taken = new Set([...(options.existingCountries ?? [])].map((c) => c.toUpperCase()));
  const limit = options.maxRules ?? Number.POSITIVE_INFINITY;
  const rules: MarketplaceRule[] = [];

  for (const store of AMAZON_STOREFRONTS) {
    if (rules.length >= limit) break;
    if (store.domain === parsed.storefront.domain) continue;

    const countries = store.countries.filter((country) => !taken.has(country));
    // The store's own country is the point of the rule; neighbours alone aren't worth a slot.
    if (!countries.includes(store.countries[0]!)) continue;

    rules.push({
      storefront: store.label,
      type: "country",
      condition: "in",
      values: countries,
      action: "redirect",
      destination: `https://www.${store.domain}${parsed.pathAndQuery}`,
    });
  }

  return rules;
}

// Edge-safe (used by src/middleware.ts): no db, Node-only or network imports.
import { APP_BASE_DOMAIN, PLATFORM_DOMAINS } from "@/lib/constants/domains";

import type { Metadata } from "next";

export const NO_INDEX_HEADER = "noindex, nofollow";

// For short-link and interstitial pages. Clearing the canonical matters: the
// root layout's self-canonical would point crawlers at the short URL.
export const noIndexMetadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: null },
} satisfies Metadata;

// The marketing site is canonically served on the bare app domain; these
// routes 301 there from every other platform host so crawlers stop indexing
// copies of them.
const MARKETING_PATHS = new Set([
  "/",
  "/pricing",
  "/features",
  "/qr-code-generator",
  "/utm-builder",
  "/url-expander",
  "/extension",
  "/whatsapp-link-generator",
  "/gerador-de-link-whatsapp",
  "/blog",
  "/compare",
  "/open-source-url-shortener",
  "/solutions",
  "/customers/airo",
  "/changelog",
  "/abuse",
  "/privacy",
  "/terms",
  "/sitemap.xml",
  "/llms.txt",
]);
const MARKETING_PREFIXES = ["/blog/", "/compare/", "/solutions/"];

// Short-link domains, their www hosts, and subdomains of the app domain (www,
// status, team subdomains). Team subdomains of the other short domains are
// left alone; "www" is a reserved team slug, so it never names a team.
const NON_PRIMARY_HOSTS = new Set([
  ...PLATFORM_DOMAINS.filter((domain) => domain !== APP_BASE_DOMAIN),
  ...PLATFORM_DOMAINS.map((domain) => `www.${domain}`),
]);

function normalizeHost(host: string): string {
  return (host.split(":")[0] ?? host).replace(/\.$/, "").toLowerCase();
}

function isNonPrimaryHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return NON_PRIMARY_HOSTS.has(normalized) || normalized.endsWith(`.${APP_BASE_DOMAIN}`);
}

function isMarketingPath(pathname: string): boolean {
  return (
    MARKETING_PATHS.has(pathname) ||
    MARKETING_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

/** The app-domain URL a marketing request on another platform host moves to, else null. */
export function getMarketingRedirectUrl(
  host: string,
  pathname: string,
  search: string,
): string | null {
  if (!isNonPrimaryHost(host) || !isMarketingPath(pathname)) return null;
  return `https://${APP_BASE_DOMAIN}${pathname}${search}`;
}

// Every top-level segment the app serves itself. Any other single-segment
// path falls through to the [linkAlias] route; indexing.test.ts fails when a
// new top-level route under src/app is missing here.
export const APP_TOP_LEVEL_SEGMENTS = new Set([
  // Domain proofs such as /.well-known/mcp-registry-auth (app host only).
  ".well-known",
  "abuse",
  "account",
  "api",
  "apple-icon.png",
  "auth",
  "blog",
  "changelog",
  "compare",
  "customers",
  "dashboard",
  "docs-site",
  "extension",
  "favicon.ico",
  "features",
  "gerador-de-link-whatsapp",
  "icon.png",
  "fonts",
  "llms.txt",
  "manifest.webmanifest",
  // The MCP endpoint: src/middleware.ts rewrites /mcp on the app host to /api/mcp.
  "mcp",
  "open-source-url-shortener",
  "opengraph-image",
  "p",
  "p-host",
  "pricing",
  "privacy",
  "qr-code-generator",
  "robots.txt",
  "sitemap.xml",
  // public/social: marketing images served as static assets, never short links.
  "social",
  "solutions",
  "stats",
  "teams",
  "terms",
  "url-expander",
  "utm-builder",
  "whatsapp-link-generator",
]);

const INTERSTITIAL_PREFIXES = [
  "/blocked/",
  "/expired/",
  "/scheduled/",
  "/verify-password/",
  "/verified-redirect/",
  "/cloaked/",
  // Contact card pages (/c/<id>) and their .vcf hold people's details.
  "/c/",
];

/**
 * True for paths served by the [linkAlias] route or a link interstitial. These
 * responses carry the destination's title/metadata, so they must never be
 * indexed under the short URL.
 */
export function isShortLinkPath(pathname: string): boolean {
  if (INTERSTITIAL_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  const segment = pathname.slice(1);
  return segment.length > 0 && !segment.includes("/") && !APP_TOP_LEVEL_SEGMENTS.has(segment);
}

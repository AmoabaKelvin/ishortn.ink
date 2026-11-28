// Edge-safe: the worker entry runs this on every request, before Next loads.
// No db, logger, env or network imports.
import { extractShortenIntent } from "@/lib/auth/shorten-intent";
import { socialMediaAgents } from "@/lib/constants/app";
import { DEFAULT_PLATFORM_DOMAIN, getAppBaseDomain } from "@/lib/constants/domains";
import { isDocsPath } from "@/lib/docs/routing";
import { getMarketingRedirectUrl, isShortLinkPath } from "@/lib/seo/indexing";

export const cleanUrl = (url: string) => url.replace(/^(https?:\/\/)?(www\.)?/, "");

// Trust the incoming host; local dev, the staging host, and *.workers.dev
// preview hosts resolve against the default domain.
export function getLinkDomain(incomingDomain: string | null): string {
  if (!incomingDomain) return DEFAULT_PLATFORM_DOMAIN;
  const host = incomingDomain.split(":")[0] ?? incomingDomain;
  if (host.includes("localhost")) return DEFAULT_PLATFORM_DOMAIN;
  if (host === process.env.STAGING_DOMAIN) return DEFAULT_PLATFORM_DOMAIN;
  if (host.endsWith(".workers.dev")) return DEFAULT_PLATFORM_DOMAIN;
  return host;
}

export const cleanAlias = (incomingAlias: string): string => {
  let alias = incomingAlias;
  if (alias.endsWith("!")) {
    alias = alias.slice(0, -1);
  }
  return alias.toLowerCase();
};

export const isSocialMediaAgent = (userAgent: string | null): boolean =>
  socialMediaAgents.some((agent) => userAgent?.includes(agent));

// Sources of next.config.js redirects(), which Next applies before routing.
const NEXT_CONFIG_REDIRECT_PATHS = new Set(["/sign-in", "/sign-up"]);

const SINGLE_SEGMENT_PATH = /^\/[^/]+$/;

export type CachedRedirectTarget = { domain: string; alias: string };

/**
 * The link address of a request the [linkAlias] page would answer with a plain
 * redirect, or null for everything else: other routes, paths middleware.ts or
 * next.config.js handle first, RSC requests, "!" previews and link-preview
 * crawlers. Null only means "let Next handle it", so when unsure, return null.
 */
export function getCachedRedirectTarget(request: Request): CachedRedirectTarget | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  const { pathname } = url;
  if (!SINGLE_SEGMENT_PATH.test(pathname) || !isShortLinkPath(pathname)) return null;
  if (NEXT_CONFIG_REDIRECT_PATHS.has(pathname)) return null;

  // Client-side navigations and prefetches expect an RSC payload, not a redirect.
  const { headers } = request;
  if (headers.has("rsc") || headers.has("next-router-prefetch") || url.searchParams.has("_rsc")) {
    return null;
  }

  // Clerk's middleware consumes its handshake and dev-browser params.
  if ([...url.searchParams.keys()].some((key) => key.startsWith("__clerk"))) return null;

  // The checks middleware.ts makes before a short link reaches the page.
  const host = headers.get("x-forwarded-host") ?? url.host;
  const hostname = (host.split(":")[0] ?? host).toLowerCase();
  if (hostname === `docs.${getAppBaseDomain()}`) return null;
  if (extractShortenIntent(url)) return null;
  if (isDocsPath(pathname)) return null;
  if (getMarketingRedirectUrl(host, pathname, url.search)) return null;

  // The [linkAlias] page's own early exits: .png is a 404, and "!" previews and
  // crawlers get a rendered page instead of a redirect.
  let linkAlias: string;
  try {
    linkAlias = decodeURIComponent(pathname.slice(1));
  } catch {
    return null;
  }
  if (linkAlias.toLowerCase().endsWith(".png") || linkAlias.endsWith("!")) return null;
  if (isSocialMediaAgent(headers.get("user-agent"))) return null;

  const incomingDomain = headers.get("x-forwarded-host") ?? headers.get("host") ?? url.host;
  return { domain: cleanUrl(getLinkDomain(incomingDomain)), alias: cleanAlias(linkAlias) };
}

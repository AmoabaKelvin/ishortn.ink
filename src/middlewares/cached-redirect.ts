// The plain short-link redirect, answered from the KV cache before Next loads
// (custom-worker.ts). Rendering the [linkAlias] page costs ~100ms of CPU per
// click; this is a KV read or two. Anything it can't answer exactly as that page would
// returns null and goes to Next, so keep every check here conservative.
//
// Wrangler bundles this outside the Next build: no db, logger, `server-only` or
// env.mjs in its imports (the logger's `server-only` throws there, and env.mjs
// validates process.env when it loads). cached-redirect.test.ts checks this.
import { buildCacheKey, getFromCache, getGeoRulesFromCache } from "@/lib/core/cache";
import { getClientIp, getRequestGeo } from "@/lib/platform";
import { NO_INDEX_HEADER } from "@/lib/seo/indexing";
import { recordClick } from "@/middlewares/enqueue-click";
import { appendUtmParams, isLinkScheduled, isPastDisableDate } from "@/middlewares/link-policy";

import type { Link } from "@/lib/core/cache";
import type { CachedRedirectTarget } from "@/lib/routing/short-link-request";

// The headers the page's redirect() response carries: next.config.js headers()
// for "/(.*)", middleware.ts's X-Robots-Tag for short links, and Next's
// no-store for dynamic pages. cached-redirect.test.ts keeps the first set in
// step with next.config.js.
export const CACHED_REDIRECT_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "on",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Robots-Tag": NO_INDEX_HEADER,
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
} as const satisfies Record<string, string>;

export type CachedRedirect = {
  response: Response;
  /** Queues the click; the caller hands it to waitUntil. */
  click: Promise<void>;
};

// Links whose resolution needs more than the cached row (click caps and the
// verified-clicks plan check read the database; password and cloaking render a
// page) or that resolve to a state page (blocked, disabled, expired, scheduled).
function needsFullResolution(link: Link): boolean {
  return (
    !!link.blocked ||
    !!link.disabled ||
    !!link.passwordHash ||
    !!link.cloaking ||
    !!link.verifiedClicksEnabled ||
    !!link.disableLinkAfterClicks ||
    isPastDisableDate(link) ||
    isLinkScheduled(link)
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The redirect for a cached plain link with no targeting rules, or null to let
 * Next resolve it. No click is queued unless a redirect is returned, so falling
 * back never counts a click twice.
 */
export async function redirectFromCache(
  request: Request,
  target: CachedRedirectTarget,
  /** The worker's bindings. */
  bindings: { IP_HASH_SECRET?: string },
): Promise<CachedRedirect | null> {
  const link = await getFromCache(buildCacheKey(target.domain, target.alias));
  if (!link?.url || needsFullResolution(link)) return null;

  // Null is a cache miss. Links with rules stay on Next, which owns the
  // matcher (it logs, so it can't load here). On fallback the page reads the
  // link and rules again; a KV read or two is cheap next to rendering.
  const rules = await getGeoRulesFromCache(link.id);
  if (rules === null || rules.length > 0) return null;

  const destination = appendUtmParams(link.url, link.utmParams);
  if (!isHttpUrl(destination)) return null;

  // Built before the click is queued: a destination that isn't a valid header
  // value (raw non-ASCII, which only UTM rewriting would percent-encode) makes
  // this throw, and Next must then answer without a click already queued here.
  let response: Response;
  try {
    response = new Response(null, {
      status: 307,
      headers: { ...CACHED_REDIRECT_HEADERS, Location: destination },
    });
  } catch {
    return null;
  }

  // Next's path reads env.mjs, i.e. process.env, which OpenNext fills from the
  // bindings and from the build's .env files (production builds write server
  // env into .env.production.local). Reading both keeps one secret per IP, so
  // unique visitors aren't split between the two paths.
  const ipHashSecret = bindings.IP_HASH_SECRET ?? process.env.IP_HASH_SECRET;
  const geo = getRequestGeo();
  const click = recordClick({
    headers: request.headers,
    link,
    ip: getClientIp(request.headers) ?? "",
    country: geo.country ?? "Unknown",
    city: geo.city ?? "Unknown",
    ipHashSecret,
  });
  return { response, click };
}

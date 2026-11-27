// Edge middleware only. @opennextjs/cloudflare does not support Node.js
// middleware, so this file must stay edge-safe: no db/pino/react-email
// imports. Link resolution and click analytics intentionally live in
// app/(links)/[linkAlias]/page.tsx.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  SHORTEN_INTENT_COOKIE,
  SHORTEN_INTENT_COOKIE_OPTIONS,
  clearShortenIntent,
  extractShortenIntent,
  isShortenIntentLanding,
} from "@/lib/auth/shorten-intent";
import {
  extractPlatformSubdomain,
  getAppBaseDomain,
  isPlatformDomain,
} from "@/lib/constants/domains";
import { isDocsPath, legacyDocsRedirectPath, toInternalDocsPath } from "@/lib/docs/routing";
import { NO_INDEX_HEADER, getMarketingRedirectUrl, isShortLinkPath } from "@/lib/seo/indexing";

import type { NextFetchEvent, NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

const clerk = clerkMiddleware(async (auth, req) => {
  const { pathname, search, host: urlHost } = new URL(req.url);
  // Same precedence as the [linkAlias] page: a proxy may forward the custom
  // domain in x-forwarded-host while the URL holds the platform host.
  const host = req.headers.get("x-forwarded-host") ?? urlHost;
  const bareHost = host.split(":")[0] ?? host;
  const hostname = bareHost.toLowerCase();
  const appHost = getAppBaseDomain();

  // The retired external docs site: send every old URL to its /docs page.
  if (hostname === `docs.${appHost}`) {
    return NextResponse.redirect(`https://${appHost}${legacyDocsRedirectPath(pathname)}`, 308);
  }

  // Keep a shorten-this-URL destination out of the auth page's address bar
  // (and so out of analytics and Referer); the page reads it from the cookie.
  const shortenIntent = extractShortenIntent(new URL(req.url));
  if (shortenIntent) {
    const response = NextResponse.redirect(shortenIntent.cleanUrl, 307);
    if (shortenIntent.intent) {
      response.cookies.set(SHORTEN_INTENT_COOKIE, shortenIntent.intent, {
        ...SHORTEN_INTENT_COOKIE_OPTIONS,
        secure: shortenIntent.cleanUrl.protocol === "https:",
      });
    }
    return response;
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
    // The shorten intent has been used once the editor opens with it; clear it
    // so a later sign-in on this browser doesn't prefill the same URL again.
    if (isShortenIntentLanding(req.nextUrl)) return clearShortenIntent(NextResponse.next());
    return;
  }

  // Docs live on the app host only; elsewhere /docs stays a short-link alias.
  if (isDocsPath(pathname)) {
    if (hostname === `www.${appHost}`) {
      return NextResponse.redirect(`https://${appHost}${pathname}${search}`, 301);
    }
    if (
      hostname === appHost ||
      hostname.includes("localhost") ||
      hostname.endsWith(".workers.dev")
    ) {
      return NextResponse.rewrite(new URL(`${toInternalDocsPath(pathname)}${search}`, req.url));
    }
  }

  const marketingRedirect = getMarketingRedirectUrl(host, pathname, search);
  if (marketingRedirect) return NextResponse.redirect(marketingRedirect, 301);

  // Short-link responses carry the destination's title; keep them out of
  // search indexes. A header (unlike a meta tag) also covers the bodiless 307.
  if (isShortLinkPath(pathname)) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", NO_INDEX_HEADER);
    return response;
  }

  // A verified custom domain serves its owner's bio page at the domain root.
  // Short links on the same domain are deeper paths and resolve via the
  // [linkAlias] page.
  if (
    pathname === "/" &&
    bareHost &&
    !bareHost.includes("localhost") &&
    !bareHost.endsWith(".workers.dev") && // preview URLs keep the marketing root
    !isPlatformDomain(bareHost) &&
    extractPlatformSubdomain(bareHost) === null
  ) {
    // www serves the bare domain's bio page, matching link resolution's
    // www-stripping (apex customers on www-CNAME setups depend on this).
    const bioHost = bareHost.replace(/^www\./, "");
    return NextResponse.rewrite(new URL(`/p-host/${encodeURIComponent(bioHost)}`, req.url));
  }
});

/**
 * The MCP endpoint is https://<app host>/mcp. Only the app host serves it, so /mcp stays a
 * short-link alias on every short-link domain. It authenticates with an API key, so it skips
 * Clerk, which would otherwise try to read the bearer key as a session token.
 */
function mcpRewrite(req: NextRequest): NextResponse | null {
  const url = req.nextUrl;
  if (url.pathname !== "/mcp") return null;
  const hostname = (req.headers.get("x-forwarded-host") ?? url.host).split(":")[0]!.toLowerCase();
  const appHost = getAppBaseDomain();
  if (
    hostname !== appHost &&
    hostname !== `www.${appHost}` &&
    !hostname.includes("localhost") &&
    !hostname.endsWith(".workers.dev")
  ) {
    return null;
  }
  return NextResponse.rewrite(new URL(`/api/mcp${url.search}`, req.url));
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  return mcpRewrite(req) ?? clerk(req, event);
}

// /api/health and /api/health/* are excluded: they are public or check their
// own token, and an uptime probe must not depend on Clerk being reachable.
// /api/extension/* is excluded too: it authenticates with its own bearer token,
// which Clerk would otherwise try to read as a session token. /api/mcp likewise (see mcpRewrite).
export const config = {
  matcher: [
    "/((?!_next|favicon|api/health(?:/|$)|api/extension(?:/|$)|api/mcp(?:/|$)|^[^/]+$|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api(?!/health(?:/|$)|/extension(?:/|$)|/mcp(?:/|$))|trpc)(.*)",
  ],
};

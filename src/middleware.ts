// Edge middleware only. @opennextjs/cloudflare does not support Node.js
// middleware, so this file must stay edge-safe: no db/pino/react-email
// imports. Link resolution and click analytics intentionally live in
// app/(links)/[linkAlias]/page.tsx.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  extractPlatformSubdomain,
  getAppBaseDomain,
  isPlatformDomain,
} from "@/lib/constants/domains";
import { isDocsPath, legacyDocsRedirectPath, toInternalDocsPath } from "@/lib/docs/routing";
import { NO_INDEX_HEADER, getMarketingRedirectUrl, isShortLinkPath } from "@/lib/seo/indexing";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
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

  if (isProtectedRoute(req)) {
    await auth.protect();
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

// /api/health/* is excluded: it authenticates with its own token, and an
// uptime probe must not depend on Clerk being reachable.
export const config = {
  matcher: [
    "/((?!_next|favicon|api/health/|^[^/]+$|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api(?!/health/)|trpc)(.*)",
  ],
};

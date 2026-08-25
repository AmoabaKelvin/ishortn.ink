// Edge middleware only. @opennextjs/cloudflare does not support Node.js
// middleware, so this file must stay edge-safe: no db/pino/react-email
// imports. Link resolution and click analytics intentionally live in
// app/(main)/[linkAlias]/page.tsx.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { extractPlatformSubdomain, isPlatformDomain } from "@/lib/constants/domains";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
    return;
  }

  const { pathname, host: urlHost } = new URL(req.url);
  // Same precedence as the [linkAlias] page: a proxy may forward the custom
  // domain in x-forwarded-host while the URL holds the platform host.
  const host = req.headers.get("x-forwarded-host") ?? urlHost;

  // A verified custom domain serves its owner's bio page at the domain root.
  // Short links on the same domain are deeper paths and resolve via the
  // [linkAlias] page.
  const bareHost = host.split(":")[0] ?? host;
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

export const config = {
  matcher: [
    "/((?!_next|favicon|^[^/]+$|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

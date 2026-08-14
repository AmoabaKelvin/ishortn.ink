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

  const { pathname, host } = new URL(req.url);

  // A verified custom domain serves its owner's bio page at the domain root.
  // Short links on the same domain are deeper paths and resolve via the
  // [linkAlias] page.
  const bareHost = host.split(":")[0] ?? host;
  if (
    pathname === "/" &&
    bareHost &&
    !bareHost.includes("localhost") &&
    !bareHost.endsWith(".vercel.app") && // preview/deploy URLs keep the marketing root
    !bareHost.endsWith(".workers.dev") &&
    !isPlatformDomain(bareHost) &&
    extractPlatformSubdomain(bareHost) === null
  ) {
    return NextResponse.rewrite(new URL(`/p-host/${encodeURIComponent(bareHost)}`, req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|favicon|^[^/]+$|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

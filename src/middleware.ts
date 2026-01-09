import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { geolocation, ipAddress } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";

import { isBot } from "@/lib/utils/is-bot";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

async function resolveLinkAndLogAnalytics(request: NextRequest) {
  if (isProtectedRoute(request)) {
    return;
  }

  const { pathname, host, origin } = new URL(request.url);

  const shouldSkip =
    pathname === "/" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/_next/") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.split("/").length > 2;

  if (shouldSkip) {
    return NextResponse.next();
  }

  const userAgent = request.headers.get("user-agent");

  if (userAgent && isBot(userAgent)) {
    return NextResponse.next();
  }

  const geo = geolocation(request);
  const ip = ipAddress(request);
  const referer = request.headers.get("referer");

  const response = await fetch(
    encodeURI(
      `${origin}/api/link?domain=${host}&alias=${pathname}&country=${geo.country}&city=${geo.city}&ip=${ip}`
    ),
    {
      headers: {
        "user-agent": userAgent ?? "",
        referer: referer ?? "",
      },
    }
  );

  if (!response.ok) {
    return NextResponse.next();
  }

  const data = await response.json();

  if (!data.url) {
    return NextResponse.next();
  }

  const redirectUrl = data.url.startsWith("http://") || data.url.startsWith("https://")
    ? data.url
    : `https://${data.url}`;

  return NextResponse.redirect(redirectUrl);
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
  return resolveLinkAndLogAnalytics(req);
});

export const config = {
  matcher: [
    "/((?!_next|favicon|^[^/]+$|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

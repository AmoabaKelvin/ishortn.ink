import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { geolocation, ipAddress } from "@vercel/functions";
import { type NextRequest, NextResponse } from "next/server";

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
    pathname.startsWith("/cloaked/") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.split("/").length > 2;

  if (shouldSkip) {
    return NextResponse.next();
  }

  const userAgent = request.headers.get("user-agent");

  // Let social media bots through to the page component so they can see OG meta tags
  if (userAgent && isBot(userAgent)) {
    return NextResponse.next();
  }

  const geo = geolocation(request);
  const ip = ipAddress(request);
  const referer = request.headers.get("referer");

  const response = await fetch(
    encodeURI(
      `${origin}/api/link?domain=${host}&alias=${pathname}&country=${geo.country}&city=${geo.city}&ip=${ip}`,
    ),
    {
      headers: {
        "user-agent": userAgent ?? "",
        referer: referer ?? "",
      },
    },
  );

  if (!response.ok) {
    return NextResponse.next();
  }

  const data = await response.json();

  if (!data.url) {
    return NextResponse.next();
  }

  // Validate and normalize the URL before redirecting
  let redirectUrl: string;
  try {
    const parsedUrl = new URL(data.url, request.url);

    // Only allow http and https protocols (reject javascript:, data:, etc.)
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      console.error(`Blocked redirect to unsafe protocol: ${parsedUrl.protocol}`);
      return NextResponse.next();
    }

    redirectUrl = parsedUrl.toString();
  } catch {
    // If URL parsing fails, try prepending https://
    try {
      const fallbackUrl = new URL(`https://${data.url}`);
      if (fallbackUrl.protocol !== "https:") {
        return NextResponse.next();
      }
      redirectUrl = fallbackUrl.toString();
    } catch {
      console.error(`Invalid redirect URL: ${data.url}`);
      return NextResponse.next();
    }
  }

  // If cloaking is enabled, rewrite to cloaked page instead of redirecting
  // This keeps the short URL in the browser's address bar
  if (data.cloaking) {
    const encodedUrl = encodeURIComponent(redirectUrl);
    return NextResponse.rewrite(new URL(`/cloaked/${encodedUrl}`, request.url));
  }

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

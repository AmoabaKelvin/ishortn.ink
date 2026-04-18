import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { geolocation, ipAddress } from "@vercel/functions";
import { type NextRequest, NextResponse } from "next/server";

import { edgeLogger } from "@/lib/logger/edge";
import { isBot } from "@/lib/utils/is-bot";

const log = edgeLogger.child({ component: "middleware" });

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

async function resolveLinkAndLogAnalytics(request: NextRequest) {
  if (isProtectedRoute(request)) {
    return;
  }

  const { pathname, host, origin } = new URL(request.url);

  const staticRoutes = ["/blog", "/changelog", "/privacy", "/terms", "/auth", "/features", "/pricing", "/compare"];

  const shouldSkip =
    pathname === "/" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/cloaked/") ||
    pathname.startsWith("/verified-redirect/") ||
    pathname.startsWith("/opengraph-image") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".xml") ||
    pathname.endsWith(".txt") ||
    pathname.endsWith(".webmanifest") ||
    staticRoutes.some((route) => pathname.startsWith(route)) ||
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

  // In localhost/development, use simulated geo data or allow override via query param
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
  const simCountry = request.nextUrl.searchParams.get("geo"); // Allow ?geo=US for testing
  const country = simCountry || geo.country || (isLocalhost ? "US" : undefined);
  const city = geo.city || (isLocalhost ? "San Francisco" : undefined);

  const forwardedHeaders: Record<string, string> = {
    "user-agent": userAgent ?? "",
    referer: referer ?? "",
  };
  // Forward the visitor IP in a header rather than a query param so it does
  // not end up in URL access logs (and anywhere else that captures URLs).
  if (ip) forwardedHeaders["x-client-ip"] = ip;
  // Forward UA Client Hints so UAParser can resolve device/model/OS details
  // that modern Chrome removes from the UA string.
  const CLIENT_HINT_HEADERS = [
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
    "sec-ch-ua-platform-version",
    "sec-ch-ua-model",
    "sec-ch-ua-arch",
    "sec-ch-ua-bitness",
    "sec-ch-ua-full-version-list",
  ];
  for (const header of CLIENT_HINT_HEADERS) {
    const value = request.headers.get(header);
    if (value) forwardedHeaders[header] = value;
  }

  const response = await fetch(
    encodeURI(
      `${origin}/api/link?domain=${host}&alias=${pathname}&country=${country}&city=${city}`,
    ),
    { headers: forwardedHeaders },
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
      log.warn(
        { protocol: parsedUrl.protocol, host, pathname },
        "Blocked redirect to unsafe protocol",
      );
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
      log.warn(
        { rawUrl: data.url, host, pathname },
        "Invalid redirect URL",
      );
      return NextResponse.next();
    }
  }

  // Ask the browser to send high-entropy UA Client Hints on future requests to
  // this origin so we can recover device model / OS version that Chrome drops
  // from the reduced User-Agent string.
  const acceptCh =
    "Sec-CH-UA-Platform-Version, Sec-CH-UA-Model, Sec-CH-UA-Arch, Sec-CH-UA-Bitness, Sec-CH-UA-Full-Version-List";

  const verificationToken =
    typeof data.verificationToken === "string" ? data.verificationToken : null;

  if (data.cloaking) {
    const encodedUrl = encodeURIComponent(redirectUrl);
    const tokenQuery = verificationToken
      ? `?t=${encodeURIComponent(verificationToken)}`
      : "";
    const rewriteResponse = NextResponse.rewrite(
      new URL(`/cloaked/${encodedUrl}${tokenQuery}`, request.url),
    );
    rewriteResponse.headers.set("Accept-CH", acceptCh);
    return rewriteResponse;
  }

  if (verificationToken) {
    const alias = pathname.replace(/^\//, "") || "link";
    const rewriteUrl = new URL(
      `/verified-redirect/${encodeURIComponent(alias)}`,
      request.url,
    );
    rewriteUrl.searchParams.set("to", redirectUrl);
    rewriteUrl.searchParams.set("t", verificationToken);
    const rewriteResponse = NextResponse.rewrite(rewriteUrl);
    rewriteResponse.headers.set("Accept-CH", acceptCh);
    return rewriteResponse;
  }

  const redirectResponse = NextResponse.redirect(redirectUrl);
  redirectResponse.headers.set("Accept-CH", acceptCh);
  return redirectResponse;
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

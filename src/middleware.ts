import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { geolocation, ipAddress } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

async function resolveLinkAndLogAnalytics(request: NextRequest) {
  if (isProtectedRoute(request)) {
    return; // Let Clerk handle protected routes
  }

  const { pathname, host } = new URL(request.url);

  if (
    pathname === "/" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  // if the pathname is more than one, we don't need to check for the api/link route
  if (pathname.split("/").length > 2) {
    return NextResponse.next();
  }

  const geo = geolocation(request);
  const ip = ipAddress(request);
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");

  const response = await fetch(
    encodeURI(
      `${
        request.url.split(pathname)[0]
      }/api/link?domain=${host}&alias=${pathname}&country=${geo.country}&city=${
        geo.city
      }&ip=${ip}`
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

  return NextResponse.redirect(data.url);
}

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect();
  return resolveLinkAndLogAnalytics(req);
});

export const config = {
  matcher: [
    "/((?!_next|favicon|^[^/]+$|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

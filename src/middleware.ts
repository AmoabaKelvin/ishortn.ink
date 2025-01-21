import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { geolocation } from "@vercel/functions";
import { NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export function userLocationMiddleware(request: NextRequest) {
  const geo = geolocation(request);
  console.log("Geo: ", geo);
  // return NextResponse.redirect(new URL('/home', request.url))
}

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect();
  return userLocationMiddleware(req);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|favicon|^[^/]+$|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

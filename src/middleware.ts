import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your Middleware
export default authMiddleware({
  publicRoutes: ["/api/webhook/clerk", "/", "/api/links", "/:shortenedLink"],

  afterAuth(auth, req) {
    // if there is no user and the route is /dashboard, redirect to sign in
    if (!auth.userId && req.nextUrl.pathname === "/dashboard") {
      console.log(">>> redirecting to sign in");
      const signInUrl = req.nextUrl.clone();
      signInUrl.pathname = "auth/sign-in";
      return NextResponse.redirect(signInUrl);
    }

    if (!auth.userId && !auth.isPublicRoute) {
      console.log(">>> redirecting to sign in");
      const signInUrl = req.nextUrl.clone();
      signInUrl.pathname = "auth/sign-in";
      return NextResponse.redirect(signInUrl);
    }

    // Redirect any logged in users to the dashboard if they try to visit the homepage
    if (auth.userId && req.nextUrl.pathname === "/") {
      console.log(">>> redirecting to dashboard");
      const dashboardUrl = req.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashboardUrl);
    }
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};

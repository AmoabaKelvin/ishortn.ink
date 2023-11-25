import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your Middleware
export default authMiddleware({
  publicRoutes: ["/api/webhook/clerk", "/", "/api/links", "/:shortenedLink"],

  afterAuth(auth, req) {
    if (!auth.userId && !auth.isPublicRoute) {
      console.log(">>> redirecting to sign in");
      return NextResponse.redirect("auth/sign-in");
    }
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};

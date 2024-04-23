import { authMiddleware } from "@clerk/nextjs";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

import { env } from "./env.mjs";

export const getValidSubdomain = (host?: string | null) => {
  let subdomain: string | null = null;
  if (!host && typeof window !== "undefined") {
    // On client side, get the host from window
    host = window.location.host;
  }
  // we should improve here for custom vercel deploy page
  if (host && host.includes(".") && !host.includes(".vercel.app")) {
    const candidate = host.split(".")[0];
    if (candidate && !candidate.includes("www")) {
      // Valid candidate
      subdomain = candidate;
    }
  }
  if (host && host.includes("serveo.net")) {
    return null;
  }

  // if (host && host.includes("docs.ishortn.ink")) {
  //   return null;
  // }

  return subdomain;
};

export default async function middleware(
  req: NextRequest,
  res: NextFetchEvent,
) {
  if (req.nextUrl.pathname === "/apple-app-site-association") {
    const host = req.headers.get("host");
    const subdomain = getValidSubdomain(host);

    console.log(subdomain);

    const response = await fetch(
      env.HOST + `/api/domains?subdomain=${subdomain}`,
    );

    const responseJson = await response.json();

    /* -------------------------------------------------------------------------- */
    /*                                HOW IT WORKS                                */
    /* -------------------------------------------------------------------------- */
    // If the app is installed on the users device, the user will be taken straight
    // to the app. If the app is not installed, the website will be shown.
    // So as soon as we see that the user is on the website, then we know that the app
    // is not installed on the users device and we can quickly redirect them to the
    // app store.
    return NextResponse.json(
      {
        applinks: {
          apps: [],
          details: [
            {
              appID: `${responseJson.link.iosTeamId}.${responseJson.link.iosBundleId}`,
              paths: ["*"],
            },
          ],
        },
      },
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const url = req.nextUrl.clone();
  const host = req.headers.get("host");

  const subdomain = getValidSubdomain(host);

  if (subdomain) {
    const paths = url.pathname.split("/").slice(1);
    // add the subdomain to the path
    url.pathname = `/application/${subdomain}/${paths.join("/")}`;
    return NextResponse.rewrite(url);
  }

  const domainsThatShouldNotRedirect = [
    "dashboard",
    "analytics",
    "application",
  ];

  const paths = url.pathname.split("/");
  // check if the path is a domain that should not redirect, and it is also not an asset file, like favicon.ico, etc.
  if (
    url.pathname.split("/").length == 2 &&
    !domainsThatShouldNotRedirect.includes(paths[1]) &&
    !paths[1].includes(".") &&
    !paths[1].startsWith("_")
  ) {
    console.log("Performing redirection in middleware");
    const response = await fetch(
      env.HOST + `/api/links/${url.pathname.split("/")[1]}`,
    );
    const responseJson = await response.json();
    console.log(responseJson);
    return NextResponse.redirect(responseJson.url);
  }

  return authMiddleware({
    publicRoutes: [
      "/api/webhook/clerk",
      "/",
      "/api/links",
      "/api/domains",
      "/api/dynamic-links",
      "/apple-app-site-association",
      "/.well-known/assetlinks.json",
      "/:shortenedLink",
      "/analytics/:shortenedLink",
      "/changelog",
    ],

    ignoredRoutes: ["/.well-known/assetlinks.json"],

    afterAuth(auth, req) {
      if (!auth.userId && req.nextUrl.pathname === "/dashboard") {
        const signInUrl = req.nextUrl.clone();
        signInUrl.pathname = "auth/sign-in";
        return NextResponse.redirect(signInUrl);
      }

      if (auth.userId && req.nextUrl.pathname === "/") {
        const dashboardUrl = req.nextUrl.clone();
        dashboardUrl.pathname = "/dashboard";
        return NextResponse.redirect(dashboardUrl);
      }
    },
  })(req, res);
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};

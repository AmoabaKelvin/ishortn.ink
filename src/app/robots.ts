import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/auth",
        "/verify-password",
        "/blocked",
        "/cloaked",
        "/api",
        "/account",
        "/teams/accept-invite",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

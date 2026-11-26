import { absoluteUrl } from "@/lib/utils/absolute-url";

import type { MetadataRoute } from "next";

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
        // Internal path of /docs (see src/lib/docs/routing.ts); only /docs is canonical.
        "/docs-site",
      ],
      // Content Signals (contentsignals.org): explicit opt-in for search, AI answers and training.
      other: { "Content-Signal": "search=yes, ai-input=yes, ai-train=yes" },
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

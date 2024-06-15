import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/utils";

const routes = [
  "",
  "/analytics",
  "/dashboard",
  "/dashboard/analytics",
  "/dashboard/tokens",
  "/dashboard/links/new",
  "/dashboard/billing",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapRoutes = routes.map((route) => ({
    url: absoluteUrl(route),
    lastModified: new Date().toISOString(),
  }));

  return [...sitemapRoutes];
}

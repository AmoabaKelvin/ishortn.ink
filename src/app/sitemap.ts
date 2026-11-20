import { getAllPosts } from "@/lib/blog";
import { competitors } from "@/lib/seo/competitors";
import { absoluteUrl } from "@/lib/utils";

import type { MetadataRoute } from "next";

// lastModified must only change when a page's content does: fixed dates for static routes (bump
// them when you edit the page), data dates for compare and blog. new Date() here would change on
// every build and teach crawlers to ignore lastmod.
// Floor for the derived dates below, so an empty post list still yields a valid date.
const SITE_LASTMOD_FLOOR = "2026-09-19";
const compareList = Object.values(competitors);
const maxDate = (a: string, b: string) => (a > b ? a : b);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();

  const blogPostEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `https://ishortn.ink/blog/${post.slug}`,
    lastModified: new Date(post.updated ?? post.date).toISOString(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  // ISO dates sort lexically, so the max string is the newest.
  const latestPostDate = posts
    .map((post) => post.updated ?? post.date)
    .reduce(maxDate, SITE_LASTMOD_FLOOR);
  const latestCompareDate = compareList
    .map((c) => c.pricesCheckedOn)
    .reduce(maxDate, SITE_LASTMOD_FLOOR);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(""),
      lastModified: "2026-09-19",
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: absoluteUrl("/pricing"),
      lastModified: "2026-11-20",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/features"),
      lastModified: "2026-09-19",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/blog"),
      lastModified: latestPostDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/changelog"),
      lastModified: "2026-09-19",
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/compare"),
      lastModified: latestCompareDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/abuse"),
      lastModified: "2026-09-19",
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: absoluteUrl("/privacy"),
      lastModified: "2026-11-20",
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: absoluteUrl("/terms"),
      lastModified: "2026-09-19",
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // High-intent comparison pages, one per competitor (src/lib/seo/competitors.ts).
  const compareEntries: MetadataRoute.Sitemap = compareList.map((c) => ({
    url: absoluteUrl(`/compare/${c.slug}`),
    lastModified: c.pricesCheckedOn,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...compareEntries, ...blogPostEntries];
}

import { getAllPosts } from "@/lib/blog";
import { getChangelogEntries } from "@/lib/changelog";
import { DOCS_PAGES, docsHref } from "@/lib/docs/navigation";
import { competitors } from "@/lib/seo/competitors";
import { solutionList } from "@/lib/seo/solutions";
import { absoluteUrl } from "@/lib/utils/absolute-url";

import type { MetadataRoute } from "next";

// lastModified must only change when a page's content does: fixed dates for static routes (bump
// them when you edit the page), data dates for compare, solutions, blog and changelog. new Date()
// here would change on every build and teach crawlers to ignore lastmod.
// Floor for the derived dates below, so an empty post list still yields a valid date.
const SITE_LASTMOD_FLOOR = "2026-09-19";
// Bump when the docs pages change.
const DOCS_LASTMOD = "2026-11-26";
const compareList = Object.values(competitors);
// The WhatsApp link generator in each language; both entries list both (hreflang).
const WHATSAPP_TOOL_LANGUAGES = {
  en: absoluteUrl("/whatsapp-link-generator"),
  "pt-BR": absoluteUrl("/gerador-de-link-whatsapp"),
};
const maxDate = (a: string, b: string) => (a > b ? a : b);

// Rebuild hourly so posts scheduled with a future `date` appear on that day without a deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, changelogEntries] = await Promise.all([getAllPosts(), getChangelogEntries()]);

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
  // Changelog dates are datetimes; keep the day so the comparison and output match the others.
  const latestChangelogDate = changelogEntries
    .map((entry) => entry.date.slice(0, 10))
    .reduce(maxDate, SITE_LASTMOD_FLOOR);
  const latestCompareDate = compareList
    .map((c) => c.pricesCheckedOn)
    .reduce(maxDate, SITE_LASTMOD_FLOOR);
  const latestSolutionDate = solutionList
    .map((s) => s.updatedOn)
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
      lastModified: "2026-11-21",
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/qr-code-generator"),
      lastModified: new Date("2026-11-20").toISOString(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/utm-builder"),
      lastModified: "2026-11-21",
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/url-expander"),
      lastModified: "2026-11-26",
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/extension"),
      lastModified: "2026-11-25",
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/whatsapp-link-generator"),
      lastModified: "2026-11-22",
      changeFrequency: "monthly",
      priority: 0.9,
      alternates: { languages: WHATSAPP_TOOL_LANGUAGES },
    },
    {
      url: absoluteUrl("/gerador-de-link-whatsapp"),
      lastModified: "2026-11-22",
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: { languages: WHATSAPP_TOOL_LANGUAGES },
    },
    {
      url: absoluteUrl("/blog"),
      lastModified: latestPostDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/changelog"),
      lastModified: latestChangelogDate,
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
      url: absoluteUrl("/open-source-url-shortener"),
      lastModified: "2026-11-26",
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/solutions"),
      lastModified: latestSolutionDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/customers/airo"),
      lastModified: "2026-11-27",
      changeFrequency: "yearly",
      priority: 0.7,
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

  // Use-case landing pages (src/lib/seo/solutions.ts).
  const solutionEntries: MetadataRoute.Sitemap = solutionList.map((s) => ({
    url: absoluteUrl(`/solutions/${s.slug}`),
    lastModified: s.updatedOn,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const docsEntries: MetadataRoute.Sitemap = DOCS_PAGES.map((page) => ({
    url: absoluteUrl(docsHref(page.slug)),
    lastModified: DOCS_LASTMOD,
    changeFrequency: "weekly",
    priority: page.slug === "" || page.slug === "api" ? 0.8 : 0.6,
  }));

  return [
    ...staticRoutes,
    ...compareEntries,
    ...solutionEntries,
    ...docsEntries,
    ...blogPostEntries,
  ];
}

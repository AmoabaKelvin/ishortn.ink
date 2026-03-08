import type { MetadataRoute } from "next";

import { getAllPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();

  const blogPostEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `https://ishortn.ink/blog/${post.slug}`,
    lastModified: new Date(post.date).toISOString(),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(""),
      lastModified: new Date().toISOString(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: absoluteUrl("/blog"),
      lastModified: new Date().toISOString(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/changelog"),
      lastModified: new Date().toISOString(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/privacy"),
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: absoluteUrl("/terms"),
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  return [...staticRoutes, ...blogPostEntries];
}

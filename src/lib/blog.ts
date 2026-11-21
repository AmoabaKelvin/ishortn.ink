import matter from "gray-matter";
import { remark } from "remark";
import gfm from "remark-gfm";
import html from "remark-html";
import { z } from "zod";

import { loadMarkdownSources } from "./markdown-sources";

const blogSources = loadMarkdownSources("content/blog", () =>
  import.meta.glob("/content/blog/*.md", { eager: true, query: "?raw" }),
);

// YAML yields a Date for unquoted dates and a string for quoted ones; keep only the date part.
function dateOnly(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const timeStart = value.indexOf("T");
  return timeStart === -1 ? value : value.slice(0, timeStart);
}

const frontmatterDate = z.union([z.date(), z.string()]).transform(dateOnly);

// Drop a missing or malformed `updated` value so it can't propagate to
// new Date(...).toISOString() (sitemap) or Article.dateModified as an invalid date.
const optionalFrontmatterDate = z
  .union([z.date(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = dateOnly(value);
    return Number.isNaN(new Date(parsed).getTime()) ? undefined : parsed;
  });

const blogPostFrontmatterSchema = z.object({
  title: z.string(),
  // Shorter <title> for posts whose title plus the " | iShortn" suffix exceeds 60 characters.
  seoTitle: z.string().optional(),
  description: z.string(),
  date: frontmatterDate,
  updated: optionalFrontmatterDate,
  author: z.string().default("Kelvin Amoaba"),
  tags: z.array(z.string()).default([]),
  image: z.string().optional(),
  published: z.boolean().default(true),
});

export type BlogPostFrontmatter = z.infer<typeof blogPostFrontmatterSchema>;

export interface BlogPost extends BlogPostFrontmatter {
  slug: string;
  content: string;
  htmlContent: string;
  readingTime: number;
}

function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

// `next dev` also shows scheduled posts so they can be previewed (and screenshotted for their PR)
// before their date. Production builds and tests keep the date gate.
const previewScheduledPosts = process.env.NODE_ENV === "development";

// Scheduled posts merge ahead of their `date` and go live on that UTC day. `now` is a parameter so
// tests can pin the clock.
export function isPostVisible(
  post: Pick<BlogPostFrontmatter, "date" | "published">,
  now: Date = new Date(),
  previewScheduled: boolean = previewScheduledPosts,
): boolean {
  if (!post.published) return false;
  // Both sides are YYYY-MM-DD, so string order is date order.
  return previewScheduled || post.date <= now.toISOString().slice(0, 10);
}

// Frontmatter-only check for pages that link to a post: skips rendering the markdown.
export function isPostLive(slug: string, now: Date = new Date()): boolean {
  const source = blogSources.get(slug);
  if (source === undefined) return false;
  return isPostVisible(blogPostFrontmatterSchema.parse(matter(source).data), now);
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const posts = await Promise.all([...blogSources.keys()].map(getPostBySlug));

  return posts
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Returns null for unpublished and (outside `next dev`) not-yet-dated posts, so their URLs 404.
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const source = blogSources.get(slug);
  if (source === undefined) {
    return null;
  }

  const { data, content } = matter(source);
  const frontmatter = blogPostFrontmatterSchema.parse(data);
  if (!isPostVisible(frontmatter)) {
    return null;
  }

  const processedContent = await remark().use(gfm).use(html).process(content);
  const htmlContent = processedContent.toString();

  return {
    ...frontmatter,
    slug,
    content,
    htmlContent,
    readingTime: estimateReadingTime(content),
  };
}

export async function getRelatedPosts(slug: string, limit = 3): Promise<BlogPost[]> {
  const allPosts = await getAllPosts();
  const currentPost = allPosts.find((post) => post.slug === slug);

  if (!currentPost) {
    return allPosts.slice(0, limit);
  }

  const currentTags = new Set(currentPost.tags);

  // Score each post by number of shared tags
  const scored = allPosts
    .filter((post) => post.slug !== slug)
    .map((post) => {
      const sharedTags = post.tags.filter((tag) => currentTags.has(tag)).length;
      return { post, score: sharedTags };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((item) => item.post);
}

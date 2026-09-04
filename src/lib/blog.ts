import fs from "fs";
import path from "path";

import matter from "gray-matter";
import { remark } from "remark";
import gfm from "remark-gfm";
import html from "remark-html";
import { z } from "zod";

const blogDirectory = path.join(process.cwd(), "content/blog");

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

export async function getAllPosts(): Promise<BlogPost[]> {
  if (!fs.existsSync(blogDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(blogDirectory);
  const markdownFiles = fileNames.filter((name) => name.endsWith(".md") || name.endsWith(".mdx"));

  const posts = await Promise.all(
    markdownFiles.map(async (fileName) => {
      const slug = fileName.replace(/\.mdx?$/, "");
      return getPostBySlug(slug);
    }),
  );

  return posts
    .filter((post): post is BlogPost => post !== null && post.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  // Try both .md and .mdx extensions
  const extensions = [".md", ".mdx"];
  let fullPath: string | null = null;

  for (const ext of extensions) {
    const candidatePath = path.join(blogDirectory, `${slug}${ext}`);
    if (fs.existsSync(candidatePath)) {
      fullPath = candidatePath;
      break;
    }
  }

  if (!fullPath) {
    return null;
  }

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  const processedContent = await remark().use(gfm).use(html).process(content);
  const htmlContent = processedContent.toString();

  return {
    ...blogPostFrontmatterSchema.parse(data),
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

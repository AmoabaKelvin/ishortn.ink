import matter from "gray-matter";
import { remark } from "remark";
import gfm from "remark-gfm";
import html from "remark-html";
import { z } from "zod";

import { loadMarkdownSources } from "./markdown-sources";

import type { Nodes, Parent, Root } from "mdast";

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
  faqs: Faq[];
}

export interface Faq {
  question: string;
  answer: string;
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

// Frontmatter-only check for pages that link to a post, so links never point at a scheduled
// post's 404. Skips rendering the markdown; unknown slugs are not live.
export function isPostLive(slug: string, now: Date = new Date()): boolean {
  const source = blogSources.get(slug);
  if (source === undefined) return false;
  return isPostVisible(blogPostFrontmatterSchema.parse(matter(source).data), now);
}

// Slug and title of each live post in `slugs`, in the given order, for pages that link to a
// curated list of posts. Scheduled, unpublished and unknown slugs are left out.
export function getLivePosts(
  slugs: readonly string[],
  now: Date = new Date(),
): { slug: string; title: string }[] {
  return slugs.flatMap((slug) => {
    const source = blogSources.get(slug);
    if (source === undefined) return [];
    const frontmatter = blogPostFrontmatterSchema.parse(matter(source).data);
    return isPostVisible(frontmatter, now) ? [{ slug, title: frontmatter.title }] : [];
  });
}

// Every published post, scheduled ones included, from frontmatter alone. For build-time assets
// (social cards) that must already exist when a scheduled post goes live between deploys.
export function getPublishedPostsFrontmatter(): (BlogPostFrontmatter & { slug: string })[] {
  return [...blogSources].flatMap(([slug, source]) => {
    const frontmatter = blogPostFrontmatterSchema.parse(matter(source).data);
    return frontmatter.published ? [{ ...frontmatter, slug }] : [];
  });
}

const BLOG_POST_PATH = /^\/blog\/([^/]+)\/?$/;

// A post linking to a scheduled one would otherwise render a link to a 404 until that post's date.
// Such links render as their text, and come back on the first revalidation after the target is live.
function isLinkToHiddenPost(url: string, now: Date): boolean {
  if (!URL.canParse(url, "https://ishortn.ink")) return false;
  const target = new URL(url, "https://ishortn.ink");
  if (target.hostname !== "ishortn.ink" && target.hostname !== "www.ishortn.ink") return false;
  const slug = BLOG_POST_PATH.exec(target.pathname)?.[1];
  return slug !== undefined && !isPostLive(slug, now);
}

function unlinkHiddenPosts(node: Parent, now: Date): void {
  node.children = node.children.flatMap((child) => {
    // Link children are phrasing content, which is valid wherever the link itself was.
    if (child.type === "link" && isLinkToHiddenPost(child.url, now)) return child.children;
    if ("children" in child) unlinkHiddenPosts(child, now);
    return [child];
  });
}

export async function renderPostBody(content: string, now: Date = new Date()): Promise<string> {
  const processed = await remark()
    .use(gfm)
    .use(() => (tree: Root) => unlinkHiddenPosts(tree, now))
    .use(html)
    .process(content);
  return processed.toString();
}

// Containers whose children are separate blocks (list items, cells), so their text gets a space
// between children. Everything else is phrasing and concatenates as written.
const BLOCK_CONTAINERS = new Set(["list", "listItem", "blockquote", "table", "tableRow"]);

// Visible text only: link and emphasis children are kept, URLs, raw HTML and images are dropped.
function plainText(node: Nodes): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if (node.type === "break") return " ";
  if (!("children" in node)) return "";
  const separator = BLOCK_CONTAINERS.has(node.type) ? " " : "";
  return node.children.map((child) => plainText(child)).join(separator);
}

const collapseWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();

function isFaqHeading(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized === "faq" ||
    normalized === "faqs" ||
    normalized === "frequently asked questions" ||
    normalized === "questions" ||
    normalized === "questions and answers" ||
    normalized.startsWith("common questions")
  );
}

// Question/answer pairs from the post's FAQ section: the first `##` heading named like an FAQ,
// with each `###` under it a question and the blocks below it, up to the next heading, its answer.
export function extractFaqs(content: string): Faq[] {
  const tree = remark().use(gfm).parse(content);
  const start = tree.children.findIndex(
    (node) =>
      node.type === "heading" &&
      node.depth === 2 &&
      isFaqHeading(collapseWhitespace(plainText(node))),
  );
  if (start === -1) return [];

  const faqs: Faq[] = [];
  let current: { question: string; blocks: string[] } | null = null;
  const flush = () => {
    if (current === null) return;
    const answer = collapseWhitespace(current.blocks.join(" "));
    if (answer !== "") faqs.push({ question: current.question, answer });
  };

  for (const node of tree.children.slice(start + 1)) {
    if (node.type === "heading" && node.depth <= 2) break;
    if (node.type === "heading" && node.depth === 3) {
      flush();
      current = { question: collapseWhitespace(plainText(node)), blocks: [] };
      continue;
    }
    current?.blocks.push(plainText(node));
  }
  flush();
  return faqs;
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

  const htmlContent = await renderPostBody(content);

  return {
    ...frontmatter,
    slug,
    content,
    htmlContent,
    readingTime: estimateReadingTime(content),
    faqs: extractFaqs(content),
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

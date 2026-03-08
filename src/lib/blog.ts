import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import gfm from "remark-gfm";

const blogDirectory = path.join(process.cwd(), "content/blog");

export interface BlogPostFrontmatter {
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  image?: string;
  published: boolean;
}

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

function parseDateString(dateValue: unknown): string {
  if (dateValue instanceof Date) {
    return dateValue.toISOString().split("T")[0] as string;
  }
  const strValue = String(dateValue);
  // Return just the date portion if it includes time
  return strValue.includes("T") ? (strValue.split("T")[0] as string) : strValue;
}

export async function getAllPosts(): Promise<BlogPost[]> {
  if (!fs.existsSync(blogDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(blogDirectory);
  const markdownFiles = fileNames.filter(
    (name) => name.endsWith(".md") || name.endsWith(".mdx"),
  );

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
    slug,
    content,
    htmlContent,
    title: String(data.title),
    description: String(data.description),
    date: parseDateString(data.date),
    author: data.author ? String(data.author) : "Kelvin Amoaba",
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    image: data.image ? String(data.image) : undefined,
    published: data.published !== false,
    readingTime: estimateReadingTime(content),
  };
}

export async function getRelatedPosts(
  slug: string,
  limit = 3,
): Promise<BlogPost[]> {
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

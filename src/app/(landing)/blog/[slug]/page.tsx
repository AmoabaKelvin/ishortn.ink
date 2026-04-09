import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "next-view-transitions";

import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog";
import {
  createArticleSchema,
  createBreadcrumbSchema,
} from "@/lib/seo/structured-data";

import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return { title: "Post Not Found - iShortn" };
  }

  return {
    title: `${post.title} - iShortn Blog`,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
      url: `https://ishortn.ink/blog/${slug}`,
      ...(post.image && { images: [{ url: post.image }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      ...(post.image && { images: [post.image] }),
    },
  };
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post || !post.published) {
    notFound();
  }

  const relatedPosts = await getRelatedPosts(slug, 3);

  const articleSchema = createArticleSchema({
    title: post.title,
    description: post.description,
    url: `https://ishortn.ink/blog/${slug}`,
    datePublished: post.date,
    dateModified: post.date,
    author: post.author,
    image: post.image,
  });

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://ishortn.ink" },
    { name: "Blog", url: "https://ishortn.ink/blog" },
    { name: post.title, url: `https://ishortn.ink/blog/${slug}` },
  ]);

  return (
    <main className="relative bg-white dark:bg-card">
      <Header />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <article className="px-6 pt-32 pb-16 md:pt-40">
        <div className="mx-auto max-w-3xl">
          {/* Breadcrumb */}
          <nav className="mb-8 flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
            <Link
              href="/"
              className="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              Home
            </Link>
            <span>/</span>
            <Link
              href="/blog"
              className="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              Blog
            </Link>
            <span>/</span>
            <span className="truncate text-neutral-500 dark:text-neutral-400">{post.title}</span>
          </nav>

          {/* Post Header */}
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span>&middot;</span>
              <span>{post.readingTime} min read</span>
            </div>

            <h1 className="mt-4 font-display text-3xl tracking-tight text-neutral-900 dark:text-foreground sm:text-4xl md:text-5xl">
              {post.title}
            </h1>

            <p className="mt-4 text-base leading-relaxed text-neutral-500 dark:text-neutral-400">
              {post.description}
            </p>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-neutral-500 dark:text-neutral-400">
                By{" "}
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {post.author}
                </span>
              </div>

              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-neutral-50 dark:bg-accent/50 px-2.5 py-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </header>

          {/* Divider */}
          <div className="mb-10 h-px bg-neutral-100 dark:bg-border/50" />

          {/* Post Content */}
          <div
            className="prose prose-neutral max-w-none prose-headings:font-sans prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-xl prose-h3:text-lg prose-p:leading-relaxed prose-p:text-neutral-600 prose-a:text-neutral-900 prose-a:underline prose-a:underline-offset-4 hover:prose-a:text-neutral-600 prose-strong:text-neutral-800 prose-ul:text-neutral-600 prose-ol:text-neutral-600 prose-li:marker:text-neutral-300"
            dangerouslySetInnerHTML={{ __html: post.htmlContent }}
          />
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="border-t border-neutral-100 dark:border-border/50 px-6 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Related Posts
            </h2>

            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.slug}
                  href={`/blog/${relatedPost.slug}`}
                  className="group rounded-xl border border-neutral-100 dark:border-border/50 p-5 transition-all hover:border-neutral-200 dark:hover:border-border hover:shadow-sm"
                >
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    {formatDate(relatedPost.date)}
                  </p>
                  <h3 className="mt-2 text-sm font-medium tracking-tight text-neutral-900 dark:text-foreground transition-colors group-hover:text-neutral-700 dark:group-hover:text-neutral-300">
                    {relatedPost.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {relatedPost.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}

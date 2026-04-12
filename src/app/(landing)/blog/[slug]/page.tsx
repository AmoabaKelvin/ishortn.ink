import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
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
  const primaryTag = post.tags[0];

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
    <main className="relative bg-zinc-950">
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

      {/* Article Header */}
      <section className="bg-zinc-950 px-6 pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <IconArrowLeft size={14} /> Back to blog
          </Link>

          {primaryTag && (
            <p className="mt-8 text-xs font-medium uppercase tracking-widest text-blue-400">
              {primaryTag}
            </p>
          )}

          <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight text-zinc-50 leading-[1.1] md:text-5xl lg:text-6xl">
            {post.title}
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-zinc-400 md:text-xl">
            {post.description}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-zinc-500">
            <span>{post.author}</span>
            <span>&middot;</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>&middot;</span>
            <span>{post.readingTime} min read</span>
          </div>

          {post.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[11px] font-medium text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Article Body */}
      <section className="bg-zinc-950 px-6 pb-24">
        <article
          className="prose prose-invert prose-zinc prose-lg mx-auto max-w-3xl prose-headings:font-heading prose-headings:tracking-tight prose-headings:text-zinc-50 prose-p:text-zinc-300 prose-p:leading-relaxed prose-a:text-blue-400 prose-a:no-underline hover:prose-a:text-blue-300 prose-strong:text-zinc-50 prose-code:rounded prose-code:bg-zinc-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:text-blue-300 prose-code:before:content-none prose-code:after:content-none prose-pre:border prose-pre:border-zinc-800 prose-pre:bg-zinc-900 prose-ol:text-zinc-300 prose-ul:text-zinc-300 prose-li:text-zinc-300 prose-li:marker:text-zinc-600 prose-hr:border-zinc-800 prose-blockquote:border-l-blue-500 prose-blockquote:text-zinc-400 prose-img:rounded-xl prose-img:border prose-img:border-zinc-800"
          dangerouslySetInnerHTML={{ __html: post.htmlContent }}
        />
      </section>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="border-t border-zinc-800 bg-zinc-950 px-6 py-20 md:py-24">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
              Related posts
            </p>
            <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl">
              Keep reading
            </h2>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((relatedPost) => {
                const relatedTag = relatedPost.tags[0];
                return (
                  <Link
                    key={relatedPost.slug}
                    href={`/blog/${relatedPost.slug}`}
                    className="group flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-colors hover:bg-zinc-900/60"
                  >
                    {relatedTag && (
                      <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
                        {relatedTag}
                      </p>
                    )}
                    <h3 className="mt-3 font-heading text-xl font-bold text-zinc-50 md:text-2xl group-hover:text-white">
                      {relatedPost.title}
                    </h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-400">
                      {relatedPost.description}
                    </p>
                    <div className="mt-6 flex items-center gap-3 text-xs text-zinc-500">
                      <time dateTime={relatedPost.date}>
                        {formatDate(relatedPost.date)}
                      </time>
                      <span>&middot;</span>
                      <span>{relatedPost.readingTime} min read</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="bg-zinc-950 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-8 py-16 text-center md:px-16 md:py-20">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-zinc-50 md:text-4xl">
              Start shortening links
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-zinc-400">
              Free forever for solo users. No credit card required.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-500 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
              Get started free
              <IconArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

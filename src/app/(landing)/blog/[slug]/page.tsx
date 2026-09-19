import { IconArticleFilled, IconChevronLeft } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { notFound } from "next/navigation";

import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog";
import { createArticleSchema, createBreadcrumbSchema } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";
import "@/styles/site-content.css";

import { CTA } from "../../_components/cta";
import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";
import {
  bodyClass,
  ButtonLink,
  cardClass,
  Eyebrow,
  h1Class,
  h3Class,
  leadClass,
  Section,
  SectionHeading,
} from "../../_components/site-primitives";

import type { Metadata } from "next";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return { title: "Post Not Found - iShortn" };
  }

  return {
    title: `${post.title} — iShortn Blog`,
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
    dateModified: post.updated ?? post.date,
    author: post.author,
    image: post.image,
  });

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://ishortn.ink" },
    { name: "Blog", url: "https://ishortn.ink/blog" },
    { name: post.title, url: `https://ishortn.ink/blog/${slug}` },
  ]);

  return (
    <main>
      <Header />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconArticleFilled aria-hidden="true" />}>{primaryTag ?? "Blog"}</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[24ch]")}>{post.title}</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>{post.description}</p>
          <p className="mt-6 text-base text-neutral-600 sm:text-sm">
            {post.author}
            <span aria-hidden="true"> · </span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden="true"> · </span>
            {post.readingTime} min read
          </p>
          {post.tags.length > 0 && (
            <ul className="mt-5 flex flex-wrap justify-center gap-2">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-neutral-950/[0.06] px-2.5 py-0.5 text-sm font-medium text-neutral-800"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section className="py-16 sm:py-20">
        <article
          className="site-prose mx-auto"
          dangerouslySetInnerHTML={{ __html: post.htmlContent }}
        />
        <div className="mx-auto mt-14 max-w-[70ch]">
          <ButtonLink href="/blog" variant="soft" arrow={false} className="pl-2.5">
            <IconChevronLeft aria-hidden="true" className="size-4 shrink-0 opacity-70" />
            All articles
          </ButtonLink>
        </div>
      </Section>

      {relatedPosts.length > 0 && (
        <Section>
          <SectionHeading title="Keep reading" />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relatedPosts.map((relatedPost) => (
              <Link
                key={relatedPost.slug}
                href={`/blog/${relatedPost.slug}`}
                className={cn(cardClass, "flex flex-col p-6 hover:bg-neutral-50")}
              >
                <p className="text-sm text-neutral-600">
                  <time dateTime={relatedPost.date}>{formatDate(relatedPost.date)}</time>
                  <span aria-hidden="true"> · </span>
                  {relatedPost.readingTime} min read
                </p>
                <h3 className={cn(h3Class, "mt-3 text-balance")}>{relatedPost.title}</h3>
                <p className={cn(bodyClass, "mt-2 line-clamp-3")}>{relatedPost.description}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <CTA />
      <Footer />
    </main>
  );
}

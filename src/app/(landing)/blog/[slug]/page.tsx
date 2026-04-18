import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "next-view-transitions";

import { getAllPosts, getPostBySlug, getRelatedPosts } from "@/lib/blog";
import {
  createArticleSchema,
  createBreadcrumbSchema,
} from "@/lib/seo/structured-data";
import { Paths } from "@/lib/constants/app";

import { Footer } from "../../_components/footer";
import { Header } from "../../_components/header";
import { Icon } from "../../_components/warm-primitives";

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
    <main style={{ background: "var(--warm-bg)", color: "var(--warm-ink)" }}>
      <Header />

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <section style={{ padding: "120px 0 40px" }}>
        <div className="warm-container" style={{ maxWidth: 860 }}>
          <Link
            href="/blog"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--warm-mute)",
            }}
          >
            ← Back to blog
          </Link>

          {primaryTag && (
            <div
              style={{
                marginTop: 32,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--warm-accent)",
              }}
            >
              {primaryTag}
            </div>
          )}

          <h1
            className="warm-display"
            style={{
              margin: "16px 0 0",
              fontSize: "clamp(40px, 6vw, 64px)",
              lineHeight: 1.1,
            }}
          >
            {post.title}
          </h1>

          <p
            style={{
              fontSize: 19,
              color: "var(--warm-ink-soft)",
              marginTop: 20,
              lineHeight: 1.55,
              fontFamily: "var(--font-warm-display)",
              fontWeight: 300,
            }}
          >
            {post.description}
          </p>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              fontSize: 14,
              color: "var(--warm-mute)",
              alignItems: "center",
            }}
          >
            <span>{post.author}</span>
            <span>·</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>·</span>
            <span>{post.readingTime} min read</span>
          </div>

          {post.tags.length > 0 && (
            <div
              style={{
                marginTop: 20,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 999,
                    border: "1px solid var(--warm-line)",
                    background: "var(--warm-paper)",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--warm-ink-soft)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: "24px 0 120px" }}>
        <article
          className="warm-container warm-legal-prose"
          style={{ maxWidth: 760, fontFamily: "var(--font-warm-ui)" }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Markdown content is parsed server-side via remark
          dangerouslySetInnerHTML={{ __html: post.htmlContent }}
        />
      </section>

      {relatedPosts.length > 0 && (
        <section
          style={{
            padding: "72px 0",
            borderTop: "1px solid var(--warm-line-soft)",
          }}
        >
          <div className="warm-container">
            <div className="warm-eyebrow" style={{ marginBottom: 20 }}>
              <Icon.Sparkle
                style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
              />
              Related posts
            </div>
            <h2
              className="warm-display"
              style={{ margin: 0, fontSize: "clamp(36px, 5vw, 48px)" }}
            >
              Keep reading.
            </h2>
            <div
              className="warm-blog-grid"
              style={{ display: "grid", gap: 20, marginTop: 40 }}
            >
              {relatedPosts.map((relatedPost) => {
                const relatedTag = relatedPost.tags[0];
                return (
                  <Link
                    key={relatedPost.slug}
                    href={`/blog/${relatedPost.slug}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      background: "var(--warm-paper)",
                      border: "1px solid var(--warm-line)",
                      borderRadius: 24,
                      padding: 28,
                    }}
                  >
                    {relatedTag && (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "var(--warm-accent)",
                        }}
                      >
                        {relatedTag}
                      </div>
                    )}
                    <h3
                      style={{
                        fontFamily: "var(--font-warm-display)",
                        fontSize: 22,
                        fontWeight: 500,
                        letterSpacing: "-0.02em",
                        margin: "12px 0 12px",
                        lineHeight: 1.2,
                      }}
                    >
                      {relatedPost.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--warm-mute)",
                        margin: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      {relatedPost.description}
                    </p>
                    <div
                      style={{
                        marginTop: 24,
                        fontSize: 12,
                        color: "var(--warm-mute)",
                      }}
                    >
                      <time dateTime={relatedPost.date}>
                        {formatDate(relatedPost.date)}
                      </time>{" "}
                      · {relatedPost.readingTime} min read
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section
        style={{
          padding: "96px 0",
          borderTop: "1px solid var(--warm-line-soft)",
        }}
      >
        <div className="warm-container">
          <div
            style={{
              background: "var(--warm-paper)",
              border: "1px solid var(--warm-line)",
              borderRadius: 32,
              padding: "56px 32px",
              textAlign: "center",
            }}
          >
            <h2
              className="warm-display"
              style={{ margin: 0, fontSize: "clamp(36px, 5vw, 48px)" }}
            >
              Start <em style={{ color: "var(--warm-accent)", fontStyle: "italic" }}>shortening</em>.
            </h2>
            <p
              style={{
                fontSize: 17,
                color: "var(--warm-mute)",
                marginTop: 16,
                maxWidth: 460,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              Free to start. No credit card required.
            </p>
            <Link
              href={Paths.Signup}
              className="warm-btn warm-btn-accent warm-btn-lg"
              style={{ marginTop: 28 }}
            >
              Get started free <Icon.Arrow />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

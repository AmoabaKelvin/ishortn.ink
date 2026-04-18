import type { Metadata } from "next";
import { Link } from "next-view-transitions";

import { getAllPosts } from "@/lib/blog";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import { Icon } from "../_components/warm-primitives";

export const metadata: Metadata = {
  title: "Blog — iShortn",
  description:
    "Tips, guides, and updates on URL shortening, link management, QR codes, and digital marketing.",
  keywords: [
    "url shortener",
    "link management",
    "short links",
    "QR codes",
    "link analytics",
    "digital marketing",
    "link tracking",
    "custom short URLs",
  ],
  openGraph: {
    title: "Blog — iShortn",
    description:
      "Tips, guides, and updates on URL shortening, link management, QR codes, and digital marketing.",
    type: "website",
    url: "https://ishortn.ink/blog",
  },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPage() {
  const posts = await getAllPosts();

  return (
    <main style={{ background: "var(--warm-bg)", color: "var(--warm-ink)" }}>
      <Header />

      <section style={{ padding: "120px 0 48px" }}>
        <div className="warm-container">
          <div className="warm-eyebrow" style={{ marginBottom: 24 }}>
            <Icon.Sparkle
              style={{ width: 12, height: 12, color: "var(--warm-accent)" }}
            />
            Blog
          </div>
          <h1
            className="warm-display"
            style={{ margin: 0, fontSize: "clamp(54px, 9vw, 104px)" }}
          >
            Writing from
            <br />
            <em style={{ fontStyle: "italic", color: "var(--warm-accent)" }}>
              the iShortn team.
            </em>
          </h1>
          <p
            style={{
              fontSize: 19,
              color: "var(--warm-mute)",
              marginTop: 24,
              lineHeight: 1.6,
              maxWidth: 620,
            }}
          >
            Product updates, guides, and deep dives on link management,
            analytics, and digital marketing.
          </p>
        </div>
      </section>

      <section style={{ padding: "24px 0 120px" }}>
        <div className="warm-container">
          {posts.length === 0 ? (
            <div
              style={{
                background: "var(--warm-paper)",
                border: "1px solid var(--warm-line)",
                borderRadius: 24,
                padding: "80px 32px",
                textAlign: "center",
                color: "var(--warm-mute)",
                fontSize: 14,
              }}
            >
              No posts yet. Check back soon.
            </div>
          ) : (
            <div
              className="warm-blog-grid"
              style={{ display: "grid", gap: 20 }}
            >
              {posts.map((post) => {
                const primaryTag = post.tags[0];
                return (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      background: "var(--warm-paper)",
                      border: "1px solid var(--warm-line)",
                      borderRadius: 24,
                      padding: 28,
                      transition: "transform .25s, border-color .2s",
                    }}
                  >
                    {primaryTag && (
                      <div
                        style={{
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
                    <h3
                      style={{
                        fontFamily: "var(--font-warm-display)",
                        fontSize: 26,
                        fontWeight: 500,
                        letterSpacing: "-0.02em",
                        margin: "12px 0 0",
                        lineHeight: 1.15,
                      }}
                    >
                      {post.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--warm-mute)",
                        margin: "12px 0 0",
                        lineHeight: 1.6,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical" as const,
                        overflow: "hidden",
                      }}
                    >
                      {post.description}
                    </p>
                    <div
                      style={{
                        marginTop: 24,
                        fontSize: 12,
                        color: "var(--warm-mute)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <time dateTime={post.date}>{formatDate(post.date)}</time>
                      <span>·</span>
                      <span>{post.readingTime} min read</span>
                    </div>
                    <div
                      style={{
                        marginTop: 24,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                        color: "var(--warm-accent)",
                        fontWeight: 500,
                      }}
                    >
                      Read article <Icon.Arrow />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />
      <style>{`
        .warm-blog-grid { grid-template-columns: 1fr; }
        @media (min-width: 720px) { .warm-blog-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .warm-blog-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
    </main>
  );
}

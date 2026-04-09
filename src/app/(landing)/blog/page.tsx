import type { Metadata } from "next";
import { Link } from "next-view-transitions";

import { getAllPosts } from "@/lib/blog";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";

export const metadata: Metadata = {
  title: "Blog - iShortn | URL Shortener Tips, Guides & Updates",
  description:
    "Tips, guides, and updates on URL shortening, link management, QR codes, and digital marketing. Learn how to get the most out of your links.",
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
    title: "Blog - iShortn | URL Shortener Tips, Guides & Updates",
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
    <main className="relative bg-white">
      <Header />

      {/* Hero */}
      <section className="px-6 pt-32 pb-12 md:pt-40 md:pb-16">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-400">
            Blog
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-neutral-900 sm:text-5xl">
            Insights & Guides
          </h1>
          <p className="mt-3 text-base text-neutral-500">
            Tips, tutorials, and updates on link management, analytics, and
            digital marketing.
          </p>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          {posts.length === 0 ? (
            <p className="py-20 text-center text-neutral-400">
              No posts yet. Check back soon.
            </p>
          ) : (
            <div className="grid gap-8">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group block rounded-2xl border border-neutral-100 p-6 transition-all hover:border-neutral-200 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                    <span>&middot;</span>
                    <span>{post.readingTime} min read</span>
                  </div>

                  <h2 className="mt-3 text-lg font-medium tracking-tight text-neutral-900 transition-colors group-hover:text-neutral-700">
                    {post.title}
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                    {post.description}
                  </p>

                  {post.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}

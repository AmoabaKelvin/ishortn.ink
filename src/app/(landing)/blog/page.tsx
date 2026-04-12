import { IconArrowRight } from "@tabler/icons-react";
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
    <main className="relative bg-zinc-950">
      <Header />

      {/* Hero */}
      <section className="bg-zinc-950 px-6 pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
            Blog
          </p>
          <h1 className="mt-4 font-heading text-5xl font-extrabold tracking-tight text-zinc-50 leading-[1.05] md:text-6xl lg:text-[5.5rem]">
            Writing from
            <br />
            the iShortn team
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl">
            Product updates, guides, and deep dives on link management,
            analytics, and digital marketing.
          </p>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="bg-zinc-950 px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          {posts.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 px-8 py-20 text-center">
              <p className="text-zinc-500">No posts yet. Check back soon.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => {
                const primaryTag = post.tags[0];
                return (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 transition-colors hover:bg-zinc-900/60"
                  >
                    {primaryTag && (
                      <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
                        {primaryTag}
                      </p>
                    )}
                    <h3 className="mt-3 font-heading text-xl font-bold text-zinc-50 md:text-2xl group-hover:text-white">
                      {post.title}
                    </h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-400">
                      {post.description}
                    </p>
                    <div className="mt-6 flex items-center gap-3 text-xs text-zinc-500">
                      <time dateTime={post.date}>{formatDate(post.date)}</time>
                      <span>&middot;</span>
                      <span>{post.readingTime} min read</span>
                    </div>
                    <div className="mt-6 inline-flex items-center gap-2 text-sm text-blue-400 opacity-0 transition-opacity group-hover:opacity-100">
                      Read article
                      <IconArrowRight size={14} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}

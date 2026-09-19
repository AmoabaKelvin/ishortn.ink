import { IconArticleFilled, IconChevronRight } from "@tabler/icons-react";
import { Link } from "next-view-transitions";

import { JsonLd } from "@/components/seo/json-ld";
import { getAllPosts } from "@/lib/blog";
import { createBreadcrumbSchema } from "@/lib/seo/structured-data";
import { cn } from "@/lib/utils";

import { Footer } from "../_components/footer";
import { Header } from "../_components/header";
import {
  bodyClass,
  cardClass,
  Eyebrow,
  h1Class,
  h3Class,
  leadClass,
  Section,
} from "../_components/site-primitives";

import type { Metadata } from "next";

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
    <main>
      <JsonLd
        data={createBreadcrumbSchema([
          { name: "Home", url: "https://ishortn.ink" },
          { name: "Blog", url: "https://ishortn.ink/blog" },
        ])}
      />
      <Header />

      <Section className="py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Eyebrow icon={<IconArticleFilled aria-hidden="true" />}>Blog</Eyebrow>
          <h1 className={cn(h1Class, "mt-5 max-w-[20ch]")}>Guides and updates from iShortn</h1>
          <p className={cn(leadClass, "mt-5 max-w-[52ch]")}>
            Product updates, guides, and deep dives on link management, analytics, and digital
            marketing.
          </p>
        </div>
      </Section>

      <Section>
        {posts.length === 0 ? (
          <p className={cn(cardClass, bodyClass, "mx-auto max-w-md p-10 text-center")}>
            No posts yet. Check back soon.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className={cn(cardClass, "flex flex-col hover:bg-neutral-50")}
              >
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-sm text-neutral-600">
                    <time dateTime={post.date}>{formatDate(post.date)}</time>
                    <span aria-hidden="true"> · </span>
                    {post.readingTime} min read
                  </p>
                  <h2 className={cn(h3Class, "mt-3 text-balance")}>{post.title}</h2>
                  <p className={cn(bodyClass, "mt-2 line-clamp-3")}>{post.description}</p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-medium text-neutral-900">
                    Read article
                    <IconChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-70" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Footer />
    </main>
  );
}

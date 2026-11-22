import { notFound } from "next/navigation";

import { getPublishedPostsFrontmatter } from "@/lib/blog";
import { ogCardResponse } from "@/lib/seo/og-card";
import { blogPostCard } from "@/lib/seo/og-cards";
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/seo/og-image";

// Cards render at build time only (the Worker can't read the font files). Scheduled posts get
// theirs in the build too, so a post that goes live between deploys already has a card.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedPostsFrontmatter().map((post) => ({ slug: post.slug }));
}

export const alt = "iShortn blog post";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPublishedPostsFrontmatter().find((p) => p.slug === slug);
  if (!post) notFound();
  return ogCardResponse(blogPostCard(post));
}

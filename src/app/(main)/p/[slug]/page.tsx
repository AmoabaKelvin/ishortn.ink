import { notFound } from "next/navigation";

import { PublicBioView } from "@/components/bio/public-bio-view";
import { api } from "@/trpc/server";

import type { Metadata } from "next";

// ISR: public pages are statically served and refreshed periodically. Edits and
// publish toggles also trigger on-demand revalidation from the bio-page service.
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await api.bioPage.getBySlug.query({ slug }).catch(() => null);
  if (!page) return { title: "Bio page not found" };

  const title = page.seoTitle || page.title || `@${page.slug}`;
  const description = page.seoDescription || page.description || undefined;

  // The og:image is supplied by the colocated opengraph-image route (which
  // honors a custom socialImageUrl or generates one from the page).
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicBioPageRoute({ params }: Props) {
  const { slug } = await params;
  const page = await api.bioPage.getBySlug.query({ slug }).catch(() => null);
  if (!page) notFound();
  return <PublicBioView page={page} />;
}

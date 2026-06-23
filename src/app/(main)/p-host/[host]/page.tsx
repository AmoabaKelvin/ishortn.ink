import { notFound } from "next/navigation";

import { PublicBioView } from "@/components/bio/public-bio-view";
import { api } from "@/trpc/server";

import type { Metadata } from "next";

// Internal route reached only via the middleware rewrite for a verified custom
// domain's root (brand.com/ -> /p-host/brand.com). Always host-specific.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ host: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { host } = await params;
  const page = await api.bioPage.getByDomain
    .query({ domain: decodeURIComponent(host) })
    .catch(() => null);
  if (!page) return {};

  const title = page.seoTitle || page.title || page.slug;
  const description = page.seoDescription || page.description || undefined;

  // og:image is supplied by the colocated opengraph-image route.
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CustomDomainBioPage({ params }: Props) {
  const { host } = await params;
  const page = await api.bioPage.getByDomain
    .query({ domain: decodeURIComponent(host) })
    .catch(() => null);
  if (!page) notFound();
  return <PublicBioView page={page} />;
}

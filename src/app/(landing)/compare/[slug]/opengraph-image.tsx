import { notFound } from "next/navigation";

import { competitors, getCompetitor } from "@/lib/seo/competitors";
import { ogCardResponse } from "@/lib/seo/og-card";
import { comparisonCard } from "@/lib/seo/og-cards";
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/seo/og-image";

// Cards render at build time only (the Worker can't read the font files), so unknown slugs 404.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(competitors).map((competitor) => ({ slug: competitor.slug }));
}

export const alt = "iShortn comparison";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const competitor = getCompetitor((await params).slug);
  if (!competitor) notFound();
  return ogCardResponse(comparisonCard(competitor));
}

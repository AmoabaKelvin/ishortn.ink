import { notFound } from "next/navigation";

import { ogCardResponse } from "@/lib/seo/og-card";
import { solutionCard } from "@/lib/seo/og-cards";
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/seo/og-image";
import { getSolution, solutionList } from "@/lib/seo/solutions";

// Cards render at build time only (the Worker can't read the font files), so unknown slugs 404.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return solutionList.map((solution) => ({ slug: solution.slug }));
}

export const alt = "iShortn solution";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const solution = getSolution((await params).slug);
  if (!solution) notFound();
  return ogCardResponse(solutionCard(solution));
}

import { notFound } from "next/navigation";

import { getDocsPageContent } from "@/lib/docs/content";
import { DOCS_PAGES } from "@/lib/docs/navigation";
import { ogCardResponse } from "@/lib/seo/og-card";
import { docsCard, docsOgImageId } from "@/lib/seo/og-cards";

// Social card of each docs page, at /docs/og/<id> (docsOgImageUrl). A plain route rather than an
// opengraph-image file: the docs pages live under an optional catch-all, and their cards need
// stable public URLs. Prerendered only, since the Worker can't read the font files.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS_PAGES.map((page) => ({ id: docsOgImageId(page.slug) }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = DOCS_PAGES.find((p) => docsOgImageId(p.slug) === id);
  if (!page) notFound();
  const { frontmatter } = getDocsPageContent(page.slug);
  return ogCardResponse(docsCard({ ...page, description: frontmatter.description }));
}

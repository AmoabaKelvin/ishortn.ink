import { and, eq } from "drizzle-orm";

import { BIO_OG_SIZE, bioOgImageResponse } from "@/components/bio/og-image";
import { db } from "@/server/db";
import { bioPage } from "@/server/db/schema";

export const runtime = "nodejs";
export const alt = "Bio page preview";
export const size = BIO_OG_SIZE;
export const contentType = "image/png";

type Props = { params: Promise<{ host: string }> };

export default async function Image({ params }: Props) {
  const { host } = await params;
  const domain = decodeURIComponent(host).toLowerCase().replace(/^www\./, "");
  const page = await db.query.bioPage
    .findFirst({
      where: and(eq(bioPage.customDomain, domain), eq(bioPage.isPublished, true)),
      columns: {
        title: true,
        slug: true,
        description: true,
        avatarUrl: true,
        theme: true,
        socialImageUrl: true,
      },
    })
    .catch(() => null);

  return bioOgImageResponse(page ?? null, page?.slug ?? "");
}

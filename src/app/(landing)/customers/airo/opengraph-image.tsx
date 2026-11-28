import { ogCardResponse } from "@/lib/seo/og-card";
import { pageCards } from "@/lib/seo/og-cards";
import { OG_IMAGE_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/seo/og-image";

// Rendered at build time only: the Worker can't read the font files.
export const dynamic = "force-static";

export const alt = pageCards.customerAiro.alt;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return ogCardResponse(pageCards.customerAiro);
}

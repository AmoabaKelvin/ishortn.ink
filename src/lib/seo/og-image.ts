import type { Metadata } from "next";

type OpenGraphImage = Extract<
  NonNullable<NonNullable<Metadata["openGraph"]>["images"]>,
  readonly unknown[]
>[number];

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = "image/png";

// src/app/opengraph-image.tsx. Only the root segment's card URL has no generated suffix: Next.js
// appends a path hash to image routes under route groups, so landing pages let it fill in theirs.
export const ROOT_OG_IMAGE_URL = "https://ishortn.ink/opengraph-image";

export type OgCardVisual = "links" | "qr" | "compare" | "none";

// What the shared template (og-card.tsx) draws.
export type OgCardProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  visual?: OgCardVisual;
  /** `links`: the destination under the short link. `compare`: the other product's name. */
  visualLabel?: string;
};

export type OgCard = OgCardProps & { alt: string };

export function ogCardAlt(title: string): string {
  return `${title} | iShortn`;
}

// Next.js resolves `openGraph` and `twitter` per segment without deep-merging. A page that sets
// `openGraph` without `images` still gets the `opengraph-image` file in its own folder (Next.js
// applies it after the page's metadata, with the URL it generates), but drops any from a parent
// folder. Landing pages sit next to their card and leave `images` unset; a page whose card lives
// elsewhere (the home page and the root card, docs) names it with this.
export function socialImages(url: string, alt: string): OpenGraphImage[] {
  return [{ url, ...OG_IMAGE_SIZE, alt, type: OG_IMAGE_CONTENT_TYPE }];
}

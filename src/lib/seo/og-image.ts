import type { Metadata } from "next";

type OpenGraphImage = Extract<
  NonNullable<NonNullable<Metadata["openGraph"]>["images"]>,
  readonly unknown[]
>[number];

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_ALT = "iShortn - Free URL Shortener with Analytics";

export const defaultOgImage = {
  url: "https://ishortn.ink/opengraph-image",
  ...OG_IMAGE_SIZE,
  alt: OG_IMAGE_ALT,
  type: "image/png",
} satisfies OpenGraphImage;

// Next.js merges `openGraph` and `twitter` per segment without deep-merging, so
// a page that sets either object drops the root `opengraph-image`. Pages pass
// this to both `images` fields; a page with its own image (a blog cover) keeps it.
export function socialImages(image?: string): OpenGraphImage[] {
  return image ? [{ url: image }] : [defaultOgImage];
}

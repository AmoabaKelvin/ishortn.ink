import { ImageResponse } from "next/og";

import { resolveBioTheme } from "./theme";

import type { BioPageTheme } from "@/server/db/schema";

export const BIO_OG_SIZE = { width: 1200, height: 630 };

type OgPage = {
  title: string | null;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  theme: BioPageTheme | null;
  socialImageUrl: string | null;
} | null;

/**
 * Renders the social-share (OG) image for a bio page. If the owner set a Pro
 * custom social image, that's used full-bleed; otherwise an image is generated
 * from the page's avatar, name, handle, and theme. Shared by the /p/[slug] and
 * custom-domain opengraph-image routes so they can't drift.
 */
export function bioOgImageResponse(page: OgPage, slug: string): ImageResponse {
  if (page?.socialImageUrl) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={page.socialImageUrl}
            alt=""
            width={BIO_OG_SIZE.width}
            height={BIO_OG_SIZE.height}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      ),
      BIO_OG_SIZE,
    );
  }

  const t = resolveBioTheme(page?.theme ?? null);
  const handle = page?.slug ?? slug;
  const title = page?.title || `@${handle}`;
  const subtitle = page?.description || `ishortn.ink/p/${handle}`;
  const isGradient = t.backgroundCss.startsWith("linear-gradient");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          padding: 96,
          textAlign: "center",
          color: t.textColor,
          ...(isGradient
            ? { backgroundImage: t.backgroundCss }
            : { backgroundColor: t.backgroundCss }),
        }}
      >
        {page?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={page.avatarUrl}
            alt=""
            width={180}
            height={180}
            style={{ borderRadius: 9999, objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              width: 180,
              height: 180,
              borderRadius: 9999,
              backgroundColor: t.accentColor,
              opacity: 0.25,
            }}
          />
        )}
        <div style={{ display: "flex", marginTop: 48, fontSize: 72, fontWeight: 700, maxWidth: 1000 }}>
          {title}
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 32, color: t.mutedColor, maxWidth: 900 }}>
          {subtitle}
        </div>
        <div style={{ display: "flex", marginTop: 56, fontSize: 24, color: t.mutedColor }}>
          Made with iShortn
        </div>
      </div>
    ),
    BIO_OG_SIZE,
  );
}

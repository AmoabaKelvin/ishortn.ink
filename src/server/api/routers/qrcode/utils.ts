import { isR2UrlOwnedBy } from "@/server/lib/storage";

import type { MarkerFrame, PixelStyle } from "@/lib/qr-generator/types";
import type { qrcode } from "@/server/db/schema";

type LegacyPatternStyle = (typeof qrcode.patternStyle.enumValues)[number];
type LegacyCornerStyle = (typeof qrcode.cornerStyle.enumValues)[number];

// QrCode.patternStyle / cornerStyle are enums from the old generator. Nothing renders from them
// (the saved image is the source of truth), but strict MySQL rejects values outside the enum, so
// each new-generator style is stored as its closest legacy equivalent.
const LEGACY_PATTERN_STYLES = {
  square: "square",
  rounded: "rounded",
  dot: "fluid",
  squircle: "rounded",
  row: "stripe",
  column: "stripe-column",
} satisfies Record<PixelStyle, LegacyPatternStyle>;

const LEGACY_CORNER_STYLES = {
  square: "square",
  circle: "circle",
  plus: "square",
  box: "square",
  octagon: "rounded",
  random: "square",
  "tiny-plus": "square",
} satisfies Record<MarkerFrame, LegacyCornerStyle>;

export function toLegacyQrStyles(pixelStyle: PixelStyle, markerFrame: MarkerFrame) {
  return {
    patternStyle: LEGACY_PATTERN_STYLES[pixelStyle],
    cornerStyle: LEGACY_CORNER_STYLES[markerFrame],
  };
}

export type StoredQrImage =
  | { type: "inline"; bytes: Buffer; contentType: string }
  | { type: "bucket"; url: string };

/**
 * Where the server can read a code's stored image from. `qrCode` holds a data URI until the R2
 * upload succeeds, then the object's public URL. Any other URL came from the client as-is, so it is
 * never fetched.
 */
export function storedQrImageSource(
  qr: { qrCode: string | null; userId: string; teamId: number | null },
  r2PublicUrl?: string,
): StoredQrImage | null {
  if (!qr.qrCode) return null;

  const dataUri = /^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/.exec(qr.qrCode);
  if (dataUri) {
    return { type: "inline", contentType: dataUri[1]!, bytes: Buffer.from(dataUri[2]!, "base64") };
  }

  // Check the URL fetch will request, so `..` segments can't step out of the workspace prefix.
  let url: string;
  try {
    url = new URL(qr.qrCode).href;
  } catch {
    return null;
  }
  return isR2UrlOwnedBy(qr, url, r2PublicUrl) ? { type: "bucket", url } : null;
}

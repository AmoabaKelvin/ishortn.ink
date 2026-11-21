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

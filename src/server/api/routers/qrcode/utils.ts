import { getPlanCaps } from "@/lib/billing/plans";
import { defaultGeneratorState } from "@/lib/qr-generator/state";
import { MarkerFrames, PixelStyles, QREffects, QRMarkerCenters } from "@/lib/qr-generator/types";
import { isR2UrlOwnedBy } from "@/server/lib/storage";

import type { Plan } from "@/lib/billing/plans";
import type { MarkerFrame, PixelStyle, QRCodeStyle } from "@/lib/qr-generator/types";
import type { qrcode, qrPreset } from "@/server/db/schema";

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

/**
 * Why a CSV import can't also create `rowCount` QR codes, or null when it can. Bulk QR is off on
 * Free, capped per import on Pro and unlimited on Ultra (team workspaces have Ultra features),
 * and the plan's total QR code cap still applies.
 */
export function bulkQrCodeLimitError({
  plan,
  rowCount,
  qrCodeCount,
}: {
  plan: Plan;
  rowCount: number;
  qrCodeCount: number;
}): string | null {
  const { bulkQrBatchLimit, qrCodeLimit } = getPlanCaps(plan);
  if (bulkQrBatchLimit === 0) {
    return "Creating QR codes from a CSV import is available on Pro and Ultra. Upgrade to use it.";
  }
  if (bulkQrBatchLimit !== undefined && rowCount > bulkQrBatchLimit) {
    return `Your plan creates up to ${bulkQrBatchLimit.toLocaleString()} QR codes per import, and this file has ${rowCount.toLocaleString()} rows. Split the file or upgrade to Ultra for unlimited QR codes.`;
  }
  if (qrCodeLimit !== undefined && qrCodeCount + rowCount > qrCodeLimit) {
    const left = Math.max(0, qrCodeLimit - qrCodeCount);
    return `Your plan allows ${qrCodeLimit.toLocaleString()} QR codes and has room for ${left.toLocaleString()} more. Upgrade to create more.`;
  }
  return null;
}

type StylePreset = Pick<
  typeof qrPreset.$inferSelect,
  | "pixelStyle"
  | "markerFrame"
  | "markerCenter"
  | "darkColor"
  | "lightColor"
  | "effect"
  | "marginNoise"
  | "marginNoiseRate"
  | "logoSize"
  | "logoMargin"
  | "logoBorderRadius"
>;

const pick = <T extends string>(values: readonly T[], value: string, fallback: T) =>
  values.find((candidate) => candidate === value) ?? fallback;

/**
 * The saved style for a code drawn with a preset, or with the generator defaults when there is
 * none. `logoImage` is set separately once the logo is stored for the code.
 */
export function qrStyleFromPreset(
  preset: StylePreset | null,
  { seed, hasLogo }: { seed: number; hasLogo: boolean },
): QRCodeStyle {
  const defaults = defaultGeneratorState();
  const rate = preset ? Number.parseFloat(preset.marginNoiseRate) : defaults.marginNoiseRate;
  return {
    pixelStyle: preset
      ? pick(PixelStyles, preset.pixelStyle, defaults.pixelStyle)
      : defaults.pixelStyle,
    markerFrame: preset
      ? pick(MarkerFrames, preset.markerFrame, defaults.markerFrame)
      : defaults.markerFrame,
    markerCenter: preset
      ? pick(QRMarkerCenters, preset.markerCenter, defaults.markerCenter)
      : defaults.markerCenter,
    darkColor: preset?.darkColor ?? defaults.darkColor,
    lightColor: preset?.lightColor ?? defaults.lightColor,
    // A logo covers modules, so the generator always switches to the highest error correction.
    ecc: hasLogo ? "H" : defaults.ecc,
    margin: defaults.margin,
    seed,
    marginNoise: preset?.marginNoise ?? defaults.marginNoise,
    marginNoiseRate: Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 0.5,
    effect: preset ? pick(QREffects, preset.effect, "none") : "none",
    logoImage: null,
    logoSize: preset?.logoSize ?? defaults.logoSize,
    logoMargin: preset?.logoMargin ?? defaults.logoMargin,
    logoBorderRadius: preset?.logoBorderRadius ?? defaults.logoBorderRadius,
  };
}

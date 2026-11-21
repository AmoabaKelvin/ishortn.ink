import { defaultGeneratorState } from "@/lib/qr-generator/state";

import type { QRCodeGeneratorState, QRCodeStyle } from "@/lib/qr-generator/types";
import type { RouterOutputs } from "@/trpc/shared";

export const SVG_EFFECTS_NOTE = "SVG uses the plain style; effects are PNG only";
export const SVG_LEGACY_NOTE = "SVG uses the plain style for codes made before SVG export";

// While the subscription is loading (or failed to load) creation stays allowed: the server enforces
// the limit on create, and blocking on an unknown state would lock out users who are under it.
export function checkIfUserCanCreateMoreQRCodes(
  subDetails: RouterOutputs["subscriptions"]["get"] | undefined,
) {
  const qrCodes = subDetails?.usage.qrCodes;
  if (!qrCodes || qrCodes.limit === null) return true;
  return qrCodes.count < qrCodes.limit;
}

export function qrCodeFileName(title: string | null | undefined, extension = "png") {
  const slug = (title ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `${slug || "qr-code"}.${extension}`;
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

type SavedQrCodeRow = RouterOutputs["qrCode"]["list"][number];
type SavedQrCode = Pick<SavedQrCodeRow, "style" | "color"> & {
  link: Pick<NonNullable<SavedQrCodeRow["link"]>, "domain" | "alias"> | null;
};

/**
 * Generator state for a saved code's SVG: the short link its PNG encodes, drawn with the style saved
 * at creation. Codes saved before styles were stored get the plain style in their saved colour.
 * Null when the code has no tracking link (legacy codes encode other content).
 */
export function savedQrCodeSvgState(qr: SavedQrCode): QRCodeGeneratorState | null {
  if (!qr.link) return null;
  const text = `https://${qr.link.domain}/${qr.link.alias}`;
  const base = { ...defaultGeneratorState(), text, scale: 20 };
  if (!qr.style) {
    const darkColor = /^#[0-9a-f]{6}$/i.test(qr.color) ? qr.color : "#000000";
    return { ...base, seed: 0, pixelStyle: "square", markerFrame: "square", darkColor };
  }
  return { ...base, ...qr.style, logoImage: qr.style.logoImage ?? undefined };
}

export function svgNoteFor(qr: Pick<SavedQrCode, "style">) {
  if (!qr.style) return SVG_LEGACY_NOTE;
  return qr.style.effect === "none" ? null : SVG_EFFECTS_NOTE;
}

/** The subset of the generator state saved with a code; `logoImage` must be a data URI. */
export function qrCodeStyleFrom(
  state: QRCodeGeneratorState,
  logoImage: string | undefined,
): QRCodeStyle {
  return {
    pixelStyle: state.pixelStyle,
    markerFrame: state.markerFrame,
    markerCenter: state.markerCenter,
    darkColor: state.darkColor,
    lightColor: state.lightColor,
    // The generator switches to H whenever a logo is set, even if the logo then fails to load.
    ecc: state.logoImage ? "H" : state.ecc,
    margin: state.margin,
    seed: state.seed,
    marginNoise: state.marginNoise,
    marginNoiseRate: state.marginNoiseRate,
    effect: state.effect,
    logoImage: logoImage ?? null,
    logoSize: state.logoSize,
    logoMargin: state.logoMargin,
    logoBorderRadius: state.logoBorderRadius,
  };
}

export function saveSvg(svg: string, fileName: string) {
  saveBlob(new Blob([svg], { type: "image/svg+xml" }), fileName);
}

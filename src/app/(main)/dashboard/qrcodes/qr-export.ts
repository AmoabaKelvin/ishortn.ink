import { generateQRCode } from "@/lib/qr-generator/generate";
import { createQrPdf } from "@/lib/qr-generator/pdf";
import { generateQRCodeSvg, toDataUri } from "@/lib/qr-generator/svg";
import { createZip } from "@/lib/utils/zip";

import type { QrPdfOptions } from "@/lib/qr-generator/pdf";
import type { QRCodeGeneratorState } from "@/lib/qr-generator/types";

// Browser-only: these draw on a canvas.

async function canvasBytes(canvas: HTMLCanvasElement, type: string, quality?: number) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error("Canvas export failed");
  return new Uint8Array(await blob.arrayBuffer());
}

/** Reads each distinct logo once; a logo that can't be read is left out of the code. */
function logoReader() {
  const cache = new Map<string, Promise<string | undefined>>();
  return (src: string | undefined) => {
    if (!src) return Promise.resolve(undefined);
    let logo = cache.get(src);
    if (!logo) {
      logo = toDataUri(src).catch(() => undefined);
      cache.set(src, logo);
    }
    return logo;
  };
}

export async function renderQrPng(state: QRCodeGeneratorState) {
  const canvas = document.createElement("canvas");
  await generateQRCode(canvas, state);
  return canvasBytes(canvas, "image/png");
}

export type QrZipItem = {
  /** File name without extension, unique within the archive (see `qrZipBaseNames`). */
  name: string;
  /** Null for legacy codes without a link: they get their stored PNG only. */
  state: QRCodeGeneratorState | null;
  /** The code's stored PNG, when it has one; otherwise the PNG is drawn from `state`. */
  storedPng?: () => Promise<Uint8Array>;
};

/** A ZIP with an SVG and a PNG per code. Codes are drawn one at a time to bound canvas memory. */
export async function buildQrZip(items: QrZipItem[]): Promise<Blob> {
  const readLogo = logoReader();
  const encoder = new TextEncoder();
  const entries: { name: string; data: Uint8Array }[] = [];

  for (const item of items) {
    const logoImage = item.state ? await readLogo(item.state.logoImage) : undefined;
    const state = item.state ? { ...item.state, logoImage } : null;
    if (state) {
      entries.push({ name: `${item.name}.svg`, data: encoder.encode(generateQRCodeSvg(state)) });
    }
    const png = item.storedPng
      ? await item.storedPng().catch(() => (state ? renderQrPng(state) : null))
      : state
        ? await renderQrPng(state)
        : null;
    if (png) entries.push({ name: `${item.name}.png`, data: png });
  }

  if (entries.length === 0) throw new Error("No QR code images to download");
  return new Blob([createZip(entries)], { type: "application/zip" });
}

const LOGO_JPEG_SIZE = 512;

/** The logo cropped to a square over the light colour, as JPEG, which a PDF embeds unchanged. */
async function logoJpeg(src: string, lightColor: string): Promise<QrPdfOptions["logoJpeg"]> {
  const img = new Image();
  img.src = await toDataUri(src);
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = LOGO_JPEG_SIZE;
  canvas.height = LOGO_JPEG_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.fillStyle = lightColor;
  ctx.fillRect(0, 0, LOGO_JPEG_SIZE, LOGO_JPEG_SIZE);
  // Cover-fit, matching the SVG's preserveAspectRatio="xMidYMid slice".
  const width = img.naturalWidth || LOGO_JPEG_SIZE;
  const height = img.naturalHeight || LOGO_JPEG_SIZE;
  const scale = LOGO_JPEG_SIZE / Math.min(width, height);
  ctx.drawImage(
    img,
    (LOGO_JPEG_SIZE - width * scale) / 2,
    (LOGO_JPEG_SIZE - height * scale) / 2,
    width * scale,
    height * scale,
  );
  const data = await canvasBytes(canvas, "image/jpeg", 0.92);
  return { data, width: LOGO_JPEG_SIZE, height: LOGO_JPEG_SIZE };
}

export async function buildQrPdf(
  state: QRCodeGeneratorState,
  options: Omit<QrPdfOptions, "logoJpeg">,
): Promise<Blob> {
  // A logo that can't be read is left out, as in the SVG.
  const logo = state.logoImage
    ? await logoJpeg(state.logoImage, state.lightColor).catch(() => null)
    : null;
  const pdf = createQrPdf(logo ? state : { ...state, logoImage: undefined }, {
    ...options,
    logoJpeg: logo,
  });
  return new Blob([pdf], { type: "application/pdf" });
}

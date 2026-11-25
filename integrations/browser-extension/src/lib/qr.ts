import QRCode from "qrcode";

const COLORS = { dark: "#0a0a0a", light: "#ffffff" };

/** Draws a QR code into `canvas` at `cssSize` CSS pixels, sharp on high-DPI screens. */
export const drawQr = async (canvas: HTMLCanvasElement, text: string, cssSize: number) => {
  const scale = Math.max(1, Math.min(3, Math.ceil(globalThis.devicePixelRatio || 1)));
  await QRCode.toCanvas(canvas, text, {
    width: cssSize * scale,
    margin: 0,
    errorCorrectionLevel: "M",
    color: COLORS,
  });
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
};

export const qrPngDataUrl = (text: string) =>
  QRCode.toDataURL(text, { width: 1024, margin: 2, errorCorrectionLevel: "M", color: COLORS });

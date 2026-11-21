import { toast } from "sonner";

import { clientLogger } from "@/lib/logger/client";
import { defaultGeneratorState, generateQRCode } from "@/lib/qr-generator";

const log = clientLogger.child({ component: "qr-export" });

export async function renderQRCodePreview(canvas: HTMLCanvasElement, text: string) {
  try {
    await generateQRCode(canvas, { ...defaultGeneratorState(), text, scale: 10, margin: 2 });
  } catch (error) {
    log.error(
      { err: error instanceof Error ? error : String(error), action: "render" },
      "failed to generate QR code",
    );
  }
}

export async function downloadQRCodePng(text: string, filename = "qrcode.png") {
  try {
    // Rendered off-screen at a higher scale than the preview so the PNG prints sharply.
    const downloadCanvas = document.createElement("canvas");
    await generateQRCode(downloadCanvas, {
      ...defaultGeneratorState(),
      text,
      scale: 20,
      margin: 2,
    });

    const pngUrl = downloadCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  } catch (error) {
    log.error(
      { err: error instanceof Error ? error : String(error), action: "download" },
      "failed to download QR code",
    );
    toast.error("Failed to download QR code");
  }
}

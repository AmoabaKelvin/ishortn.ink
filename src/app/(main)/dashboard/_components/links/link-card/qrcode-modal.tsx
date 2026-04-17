"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { clientLogger } from "@/lib/logger/client";
import { Button } from "@/components/ui/button";

const log = clientLogger.child({ component: "qr-modal" });
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateQRCode, defaultGeneratorState } from "@/lib/qr-generator";

type QRCodeModalProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  destinationUrl: string;
};

export function QRCodeModal({
  open,
  setOpen,
  destinationUrl,
}: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderQRCode = useCallback(async () => {
    if (!canvasRef.current || !destinationUrl) return;

    try {
      await generateQRCode(canvasRef.current, {
        ...defaultGeneratorState(),
        text: destinationUrl,
        scale: 10,
        margin: 2,
      });
    } catch (error) {
      log.error({ err: error, action: "render" }, "failed to generate QR code");
    }
  }, [destinationUrl]);

  useEffect(() => {
    if (open) {
      // Small delay to ensure canvas is mounted in the dialog
      const timer = setTimeout(renderQRCode, 50);
      return () => clearTimeout(timer);
    }
  }, [open, renderQRCode]);

  const handleQRCodeDownload = async () => {
    if (!canvasRef.current || !destinationUrl) return;

    try {
      // Generate a high-quality version for download
      const downloadCanvas = document.createElement("canvas");
      await generateQRCode(downloadCanvas, {
        ...defaultGeneratorState(),
        text: destinationUrl,
        scale: 20,
        margin: 2,
      });

      const pngUrl = downloadCanvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = "qrcode.png";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (error) {
      log.error({ err: error, action: "download" }, "failed to download QR code");
      toast.error("Failed to download QR code");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Scan or download your link&apos;s QR code
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex justify-center">
          <div className="rounded-lg border border-border bg-white dark:bg-card p-2">
            {destinationUrl ? (
              <canvas
                ref={canvasRef}
                className="block"
                style={{ width: "240px", height: "240px" }}
              />
            ) : (
              <div className="flex h-[240px] w-[240px] items-center justify-center text-sm text-gray-400 dark:text-neutral-500">
                No URL provided
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            className="h-9"
          >
            Close
          </Button>
          <Button onClick={handleQRCodeDownload} className="h-9">
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { downloadQRCodePng, renderQRCodePreview } from "./qrcode-export";

type QRCodeModalProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  destinationUrl: string;
};

export function QRCodeModal({ open, setOpen, destinationUrl }: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderQRCode = useCallback(async () => {
    if (!canvasRef.current || !destinationUrl) return;
    await renderQRCodePreview(canvasRef.current, destinationUrl);
  }, [destinationUrl]);

  useEffect(() => {
    if (open) {
      // Small delay to ensure canvas is mounted in the dialog
      const timer = setTimeout(renderQRCode, 50);
      return () => clearTimeout(timer);
    }
  }, [open, renderQRCode]);

  const handleQRCodeDownload = async () => {
    if (!destinationUrl) return;
    await downloadQRCodePng(destinationUrl);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>Scan or download your link&apos;s QR code</DialogDescription>
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
              <div className="flex h-[240px] w-[240px] items-center justify-center text-sm text-gray-400 dark:text-muted-foreground">
                No URL provided
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-9">
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

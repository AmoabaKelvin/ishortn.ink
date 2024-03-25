import QRCode from "qrcode.react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type QRModalProps = {
  destinationUrl: string;
  open: boolean;
  setOpen: (open: boolean) => void;
};

export function QRCodeModal({ destinationUrl, open, setOpen }: QRModalProps) {
  const qrCodeCanvasRef = useRef(null);

  const handleQRCodeDownload = () => {
    if (!destinationUrl) return;
    const canvas = document.getElementById("qr-gen") as HTMLCanvasElement;
    const pngUrl = canvas!
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `qrcode.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>
            Here is your QR Code for the link.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center">
          <QRCode
            id="qr-gen"
            value={destinationUrl}
            size={300}
            level={"H"}
            includeMargin={true}
            ref={qrCodeCanvasRef}
          />

          {/* Deactivate after Number of clicks */}
          <Button className="mt-4" onClick={handleQRCodeDownload}>
            Download Image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

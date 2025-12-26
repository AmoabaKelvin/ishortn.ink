import QRCode from "qrcode.react";
import { useRef } from "react";

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
  const qrCodeCanvasRef = useRef(null);

  const handleQRCodeDownload = () => {
    if (!destinationUrl) return;
    const canvas = document.getElementById("qr-gen") as HTMLCanvasElement;
    const pngUrl = canvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = "qrcode.png";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
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
          <div className="rounded-lg border border-border bg-white p-2">
            <QRCode
              id="qr-gen"
              value={destinationUrl}
              size={240}
              level={"H"}
              includeMargin={true}
              ref={qrCodeCanvasRef}
            />
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

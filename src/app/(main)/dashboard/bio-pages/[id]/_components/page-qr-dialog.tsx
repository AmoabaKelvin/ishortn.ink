"use client";

import { IconDownload, IconQrcode } from "@tabler/icons-react";
import { QRCodeCanvas } from "qrcode.react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PageQrDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${slug}`
      : `https://ishortn.ink/p/${slug}`;

  function download() {
    const canvas = ref.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${slug}-qr.png`;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-muted"
          title="Page QR code"
        >
          <IconQrcode size={18} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Page QR code</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col items-center gap-4">
          <div ref={ref} className="rounded-lg bg-white p-4">
            <QRCodeCanvas value={url} size={200} level="M" includeMargin />
          </div>
          <p className="break-all text-center text-[12px] text-muted-foreground">{url}</p>
          <Button onClick={download}>
            <IconDownload size={16} className="mr-1.5" /> Download PNG
          </Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

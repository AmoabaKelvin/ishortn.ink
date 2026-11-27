"use client";

import { useState } from "react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { clientLogger } from "@/lib/logger/client";
import {
  PDF_LABEL_MAX_LENGTH,
  PDF_MAX_SIZE_CM,
  PDF_MIN_SIZE_CM,
  PDF_SIZE_PRESETS_CM,
  pdfLabelText,
} from "@/lib/qr-generator/pdf";
import { cn } from "@/lib/utils";

import { buildQrPdf } from "../qr-export";
import { pdfSizeCm, qrCodeFileName, savedQrCodeSvgState, saveBlob, vectorNoteFor } from "../utils";

import type { RouterOutputs } from "@/trpc/shared";

type DownloadPdfDialogProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DEFAULT_LABEL = "Scan me";

export function DownloadPdfDialog({ qr, open, onOpenChange }: DownloadPdfDialogProps) {
  const [sizeChoice, setSizeChoice] = useState("3");
  const [customSize, setCustomSize] = useState("4");
  const [withFrame, setWithFrame] = useState(false);
  const [label, setLabel] = useState(DEFAULT_LABEL);
  const [isCreating, setIsCreating] = useState(false);

  const size = pdfSizeCm(sizeChoice, customSize);
  const sizeError = "error" in size ? size.error : null;
  const printableLabel = pdfLabelText(label);
  const labelChanged = withFrame && label.trim() !== "" && printableLabel !== label.trim();
  const note = vectorNoteFor(qr, "PDF");

  const handleDownload = async () => {
    const state = savedQrCodeSvgState(qr);
    if (!state || "error" in size) return;
    setIsCreating(true);
    trackEvent(POSTHOG_EVENTS.QR_CODE_DOWNLOADED, { format: "pdf" });
    try {
      const pdf = await buildQrPdf(state, {
        sizeMm: size.cm * 10,
        frame: withFrame ? { label: printableLabel } : null,
      });
      saveBlob(pdf, qrCodeFileName(qr.title, "pdf"));
      onOpenChange(false);
    } catch (error) {
      clientLogger.warn(
        { err: error instanceof Error ? error : String(error), qrCodeId: qr.id },
        "QR code PDF download failed",
      );
      toast.error("Couldn't create the PDF. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Download print-ready PDF</DialogTitle>
          <DialogDescription>
            A vector PDF at the exact print size, so the code stays sharp on paper.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="pdf-size"
              className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
            >
              Print size
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={sizeChoice} onValueChange={setSizeChoice}>
                <SelectTrigger
                  id="pdf-size"
                  className="h-9 border-neutral-200 bg-white text-[13px] dark:border-border dark:bg-card sm:flex-1"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PDF_SIZE_PRESETS_CM.map((cm) => (
                    <SelectItem key={cm} value={String(cm)} className="text-[13px]">
                      {cm} × {cm} cm
                    </SelectItem>
                  ))}
                  <SelectItem value="custom" className="text-[13px]">
                    Custom size
                  </SelectItem>
                </SelectContent>
              </Select>
              {sizeChoice === "custom" && (
                <div className="relative sm:w-32">
                  <Input
                    id="pdf-custom-size"
                    name="pdf-custom-size"
                    aria-label="Custom size in centimetres"
                    inputMode="decimal"
                    value={customSize}
                    onChange={(event) => setCustomSize(event.target.value)}
                    className={cn(
                      "h-9 border-neutral-200 bg-white pr-9 text-[13px] tabular-nums dark:border-border dark:bg-card",
                      sizeError && "border-red-300 focus-visible:ring-red-300",
                    )}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-neutral-400 dark:text-muted-foreground">
                    cm
                  </span>
                </div>
              )}
            </div>
            {sizeError ? (
              <p className="text-[12px] text-red-500">{sizeError}</p>
            ) : (
              <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">
                The width of the code, quiet zone included. {PDF_MIN_SIZE_CM}–{PDF_MAX_SIZE_CM} cm;
                2 cm is the smallest that scans reliably.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 dark:border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Label
                  htmlFor="pdf-frame"
                  className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Add a &ldquo;Scan me&rdquo; frame
                </Label>
                <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-muted-foreground">
                  A border in the code&apos;s colour with a label underneath.
                </p>
              </div>
              <Switch id="pdf-frame" checked={withFrame} onCheckedChange={setWithFrame} />
            </div>

            {withFrame && (
              <div className="mt-3 space-y-1.5">
                <Label
                  htmlFor="pdf-label"
                  className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Label
                </Label>
                <Input
                  id="pdf-label"
                  name="pdf-label"
                  value={label}
                  maxLength={PDF_LABEL_MAX_LENGTH}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder={DEFAULT_LABEL}
                  className="h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400 dark:border-border dark:bg-card"
                />
                {labelChanged && (
                  <p className="text-[12px] text-amber-700 dark:text-amber-400">
                    Only Latin letters print in the label. It will read &ldquo;
                    {printableLabel || "(empty)"}&rdquo;.
                  </p>
                )}
              </div>
            )}
          </div>

          {note && (
            <p className="text-[12px] text-neutral-400 dark:text-muted-foreground">{note}</p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-9 text-[13px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDownload}
            disabled={isCreating || Boolean(sizeError)}
            className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
          >
            {isCreating ? "Creating..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

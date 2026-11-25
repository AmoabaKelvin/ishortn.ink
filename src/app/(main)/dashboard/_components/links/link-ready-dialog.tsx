"use client";

import { IconCheck, IconCopy, IconDownload } from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

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
import { trackUpgradeClick, trackUpgradeShown } from "@/lib/analytics/upgrade-prompt";
import { buildUpgradeUrl } from "@/lib/billing/upgrade";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { api } from "@/trpc/react";

import { downloadQRCodePng, renderQRCodePreview } from "./link-card/qrcode-export";
import { LINK_READY_SOURCE, linkReadyOffer } from "./link-ready-offer";

export type CreatedLink = { alias: string; domain: string };

type LinkReadyDialogProps = {
  link: CreatedLink | null;
  onDone: () => void;
  onCreateAnother: () => void;
};

export function LinkReadyDialog({ link, onDone, onCreateAnother }: LinkReadyDialogProps) {
  const [copied, setCopied] = useState(false);
  // Keep the last link rendered while the dialog animates out after `link` becomes null.
  const [shownLink, setShownLink] = useState(link);
  if (link && link !== shownLink) setShownLink(link);
  const shortUrl = shownLink ? `https://${shownLink.domain}/${shownLink.alias}` : "";

  // Both create paths already load this query, so the dialog reads it from the cache.
  const { data: subscription } = api.subscriptions.get.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const offer = linkReadyOffer({ subscription: subscription ?? null });

  // One impression per opened dialog, sent once the offer line is actually on screen.
  const trackedLink = useRef<CreatedLink | null>(null);
  useEffect(() => {
    if (!link || !offer || trackedLink.current === link) return;
    trackedLink.current = link;
    trackUpgradeShown(LINK_READY_SOURCE);
  }, [link, offer]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // A callback ref draws the QR as soon as the canvas mounts inside the dialog portal.
  const qrCanvasRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (canvas && shortUrl) void renderQRCodePreview(canvas, shortUrl);
    },
    [shortUrl],
  );

  const handleCopy = async () => {
    await copyToClipboard(shortUrl);
    setCopied(true);
  };

  return (
    <Dialog
      open={link !== null}
      onOpenChange={(open) => {
        if (!open) onDone();
      }}
    >
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Your link is ready</DialogTitle>
          <DialogDescription>Copy it, share it, or download its QR code.</DialogDescription>
        </DialogHeader>

        {shownLink && (
          <DialogBody className="space-y-4">
            {/* Short URL */}
            <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-border dark:bg-accent/50">
              <p className="select-all break-all text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
                <span className="text-neutral-400 dark:text-neutral-500">https://</span>
                {shownLink.domain}/{shownLink.alias}
              </p>
              <Button
                type="button"
                onClick={handleCopy}
                className="h-10 w-full gap-1.5 bg-blue-600 text-[13px] text-white hover:bg-blue-700 sm:h-9"
              >
                {copied ? <IconCheck size={16} stroke={2} /> : <IconCopy size={16} stroke={2} />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>

            {/* QR code */}
            <div className="flex items-center gap-4">
              <div className="shrink-0 rounded-lg border border-neutral-200 bg-white p-1.5 dark:border-border">
                <canvas ref={qrCanvasRef} aria-hidden className="block h-24 w-24" />
              </div>
              <div className="min-w-0 space-y-2">
                <div>
                  <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground">
                    QR code
                  </p>
                  <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                    Scans open your short link.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => downloadQRCodePng(shortUrl, `qrcode-${shownLink.alias}.png`)}
                    className="h-10 gap-1.5 text-[13px] sm:h-9"
                  >
                    <IconDownload size={14} stroke={1.5} />
                    Download PNG
                  </Button>
                  <Link
                    href="/dashboard/qrcodes/create"
                    className="text-[12px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Customize QR code
                  </Link>
                </div>
              </div>
            </div>

            {/* Plan offer (Free personal workspaces only) */}
            {offer && (
              <p className="border-t border-neutral-100 pt-4 text-[12px] text-neutral-500 dark:border-border/50 dark:text-neutral-400">
                {offer}{" "}
                <Link
                  href={buildUpgradeUrl("pro", LINK_READY_SOURCE)}
                  onClick={() => trackUpgradeClick(LINK_READY_SOURCE)}
                  className="whitespace-nowrap font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  See plans
                </Link>
              </p>
            )}
          </DialogBody>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onCreateAnother}
            className="h-10 text-[13px] sm:h-9"
          >
            Create another link
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDone}
            className="h-10 text-[13px] sm:h-9"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { IconCheck, IconCopy, IconDownload, IconWorld } from "@tabler/icons-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

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
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { trackUpgradeClick, trackUpgradeShown } from "@/lib/analytics/upgrade-prompt";
import { buildUpgradeUrl } from "@/lib/billing/upgrade";
import {
  canShowLinkReadyPrompt,
  dismissExtensionPrompt,
  LINK_READY_STORE_URL,
  readExtensionPromptDismissed,
  recordLinkReadyView,
  subscribeExtensionPromptDismissed,
} from "@/lib/extension/prompt";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { api } from "@/trpc/react";

import { downloadQRCodePng, renderQRCodePreview } from "./link-card/qrcode-export";
import {
  FIRST_LINK_OWN_DOMAIN_SOURCE,
  LINK_READY_SOURCE,
  linkReadyOffer,
  ownDomainOffer,
} from "./link-ready-offer";

/** `isFirstLink`: the only link in a Free personal workspace (see `isFirstLink` in link.service). */
export type CreatedLink = { alias: string; domain: string; isFirstLink?: boolean };

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
  const domainOffer = ownDomainOffer({
    subscription: subscription ?? null,
    isFirstLink: shownLink?.isFirstLink ?? false,
  });
  const showDomainOffer = domainOffer !== null;
  const domainOfferPromo = domainOffer?.promo?.code;

  // One impression per opened dialog, sent once the offer is actually on screen.
  const trackedLink = useRef<CreatedLink | null>(null);
  useEffect(() => {
    if (!link || !offer || trackedLink.current === link) return;
    trackedLink.current = link;
    if (showDomainOffer) {
      trackUpgradeShown(
        FIRST_LINK_OWN_DOMAIN_SOURCE,
        domainOfferPromo ? { promo: domainOfferPromo } : undefined,
      );
    } else {
      trackUpgradeShown(LINK_READY_SOURCE);
    }
  }, [link, offer, showDomainOffer, domainOfferPromo]);

  // Browser extension note: desktop Chromium only, never next to the plan offer, and only for
  // accounts with no connected browser. Both server snapshots are "hidden" so hydration matches.
  const canPromptExtension = useSyncExternalStore(
    subscribeExtensionPromptDismissed,
    canShowLinkReadyPrompt,
    () => false,
  );
  const extensionDismissed = useSyncExternalStore(
    subscribeExtensionPromptDismissed,
    readExtensionPromptDismissed,
    () => true,
  );
  // Fetched while the create form is open, so the answer is cached before the dialog opens.
  const { data: extensions } = api.token.listExtensions.useQuery(undefined, {
    enabled: canPromptExtension && subscription !== undefined && !offer,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  // The dialog the note was picked for; it stays for that dialog even once the cap is reached.
  const [extensionPromptLink, setExtensionPromptLink] = useState<CreatedLink | null>(null);
  if (
    link &&
    link !== extensionPromptLink &&
    !offer &&
    canPromptExtension &&
    extensions?.length === 0
  ) {
    setExtensionPromptLink(link);
  }
  const countedExtensionLink = useRef<CreatedLink | null>(null);
  useEffect(() => {
    if (!extensionPromptLink || countedExtensionLink.current === extensionPromptLink) return;
    countedExtensionLink.current = extensionPromptLink;
    recordLinkReadyView();
    trackEvent(POSTHOG_EVENTS.EXTENSION_PROMPT_SHOWN, { source: LINK_READY_SOURCE });
  }, [extensionPromptLink]);
  const showExtensionPrompt =
    shownLink !== null && extensionPromptLink === shownLink && !extensionDismissed;

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
                <span className="text-neutral-400 dark:text-muted-foreground">https://</span>
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

            {/* Own-domain offer (first link, Free personal workspace, company email) */}
            {domainOffer && (
              <div className="flex flex-col gap-3 border-t border-neutral-100 pt-4 dark:border-border/50 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10">
                    <IconWorld
                      size={16}
                      stroke={1.5}
                      className="text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="break-all text-[13px] font-medium text-neutral-900 dark:text-foreground">
                      {domainOffer.title}
                    </p>
                    <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                      {domainOffer.detail}
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" className="h-10 shrink-0 text-[13px] sm:h-9">
                  <Link
                    href={buildUpgradeUrl("pro", FIRST_LINK_OWN_DOMAIN_SOURCE, domainOffer.promo)}
                    onClick={() =>
                      trackUpgradeClick(
                        FIRST_LINK_OWN_DOMAIN_SOURCE,
                        domainOfferPromo ? { promo: domainOfferPromo } : undefined,
                      )
                    }
                  >
                    Upgrade to Pro
                  </Link>
                </Button>
              </div>
            )}

            {/* Plan offer (Free personal workspaces only) */}
            {offer && !domainOffer && (
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

            {/* Browser extension note (desktop Chromium, no connected browser) */}
            {showExtensionPrompt && (
              <p className="border-t border-neutral-100 pt-4 text-[12px] text-neutral-500 dark:border-border/50 dark:text-neutral-400">
                Next time, do this from your toolbar. The iShortn extension for Chrome and Edge
                shortens the page you&apos;re on and copies the link.{" "}
                <a
                  href={LINK_READY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackEvent(POSTHOG_EVENTS.EXTENSION_PROMPT_CLICKED, {
                      source: LINK_READY_SOURCE,
                    })
                  }
                  className="whitespace-nowrap font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Add to Chrome
                </a>{" "}
                <span aria-hidden="true">&middot;</span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    trackEvent(POSTHOG_EVENTS.EXTENSION_PROMPT_DISMISSED, {
                      source: LINK_READY_SOURCE,
                    });
                    dismissExtensionPrompt();
                  }}
                  className="whitespace-nowrap font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                >
                  Not now
                </button>
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

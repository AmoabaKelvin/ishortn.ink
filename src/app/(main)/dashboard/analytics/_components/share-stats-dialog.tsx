"use client";

import { IconCheck, IconCopy, IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { api } from "@/trpc/react";

type ShareStatsDialogProps = {
  linkId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Turns a link's public, read-only stats page on or off, and copies or resets its URL. */
export function ShareStatsDialog({ linkId, open, onOpenChange }: ShareStatsDialogProps) {
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const utils = api.useUtils();

  const share = api.statsShare.get.useQuery({ id: linkId }, { enabled: open });

  const setShare = api.statsShare.set.useMutation({
    onSuccess: (state, { enabled }) => {
      utils.statsShare.get.setData({ id: linkId }, state);
      trackEvent(
        enabled ? POSTHOG_EVENTS.STATS_SHARE_ENABLED : POSTHOG_EVENTS.STATS_SHARE_DISABLED,
      );
      toast.success(enabled ? "Sharing turned on" : "Sharing turned off");
    },
    onError: (error) => toast.error(error.message),
  });

  const resetShare = api.statsShare.reset.useMutation({
    onSuccess: (state) => {
      utils.statsShare.get.setData({ id: linkId }, state);
      trackEvent(POSTHOG_EVENTS.STATS_SHARE_RESET);
      setCopied(false);
      toast.success("New link created. The old one no longer works.");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const url = share.data?.url ?? null;
  const canManage = share.data?.canManage ?? false;
  const busy = setShare.isLoading || resetShare.isLoading;

  const handleCopy = async () => {
    if (!url) return;
    await copyToClipboard(url);
    setCopied(true);
    trackEvent(POSTHOG_EVENTS.STATS_SHARE_COPIED);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Share stats</DialogTitle>
            <DialogDescription>
              A read-only page with this link&apos;s clicks, countries, devices and sources. It
              never shows the destination URL or who owns the link.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {share.isError ? (
              <p className="text-[13px] text-red-600 dark:text-red-400">
                {share.error.message || "Couldn't load sharing settings."}
              </p>
            ) : (
              <>
                {/* Toggle */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <label
                      htmlFor={`share-stats-${linkId}`}
                      className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
                    >
                      Anyone with the link can view these stats
                    </label>
                    <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                      {share.data && !canManage
                        ? "Only team admins and the link's creator can change this."
                        : "Turning this off stops the link working straight away."}
                    </p>
                  </div>
                  <Switch
                    id={`share-stats-${linkId}`}
                    checked={!!url}
                    disabled={!share.data || !canManage || busy}
                    onCheckedChange={(enabled) => setShare.mutate({ id: linkId, enabled })}
                    className="mt-0.5 shrink-0"
                  />
                </div>

                {/* Share URL: a fixed-height row so loading and toggling never move the dialog */}
                {share.isLoading ? (
                  <Skeleton className="h-9 w-full rounded-lg" />
                ) : url ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={url}
                      readOnly
                      aria-label="Share link"
                      onFocus={(event) => event.currentTarget.select()}
                      className="h-9 min-w-0 border-neutral-200 bg-white text-[13px] text-neutral-700 dark:border-border dark:bg-card dark:text-neutral-300"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopy}
                      className="h-9 shrink-0 gap-1.5 border-neutral-200 text-[13px] dark:border-border"
                    >
                      {copied ? (
                        <IconCheck size={14} stroke={1.5} />
                      ) : (
                        <IconCopy size={14} stroke={1.5} />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex h-9 items-center rounded-lg border border-dashed border-neutral-200 px-3 text-[13px] text-neutral-400 dark:border-border dark:text-muted-foreground">
                    Sharing is off
                  </div>
                )}
              </>
            )}
          </DialogBody>

          <DialogFooter className="sm:justify-between">
            {url && canManage ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmReset(true)}
                disabled={busy}
                className="h-9 gap-1.5 text-[13px] text-neutral-600 dark:text-neutral-400"
              >
                <IconRefresh size={14} stroke={1.5} />
                {resetShare.isLoading ? "Resetting..." : "Reset link"}
              </Button>
            ) : (
              <span aria-hidden="true" className="hidden sm:block" />
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-9 text-[13px]"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent className="max-w-sm border-neutral-200 dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-neutral-900 dark:text-foreground">
              Reset the share link?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
              You&apos;ll get a new link. Anyone using the current one will lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 text-[13px] hover:bg-neutral-50 dark:border-border dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetShare.mutate({ id: linkId })}
              className="h-9 bg-red-600 text-[13px] text-white hover:bg-red-700"
            >
              Reset link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

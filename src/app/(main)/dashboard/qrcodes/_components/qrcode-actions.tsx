"use client";

import {
  IconDots,
  IconDownload,
  IconFileTypePdf,
  IconLink,
  IconLinkOff,
  IconPencil,
  IconRefresh,
  IconShare,
  IconTrash,
  IconVector,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { ShareStatsDialog } from "@/app/(main)/dashboard/analytics/_components/share-stats-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { clientLogger } from "@/lib/logger/client";
import { generateQRCodeSvg, toDataUri } from "@/lib/qr-generator/svg";
import { api } from "@/trpc/react";

import { revalidateRoute } from "../../revalidate-homepage";
import { renderQrPng } from "../qr-export";
import {
  qrCodeFileName,
  savedQrCodeSvgState,
  saveBlob,
  saveSvg,
  staticTypeOf,
  svgNoteFor,
} from "../utils";
import { DownloadPdfDialog } from "./download-pdf-dialog";
import { EditQRCodeDrawer } from "./edit-qrcode-drawer";

import type { RouterOutputs } from "@/trpc/shared";

type QRCodeActionsProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
};

export function QRCodeActions({ qr }: QRCodeActionsProps) {
  const [hasOpenedDrawer, setHasOpenedDrawer] = useState(false);
  const [openEditDrawer, setOpenEditDrawer] = useState(false);
  const [resetStatsDialog, setResetStatsDialog] = useState(false);
  const [shareStatsDialog, setShareStatsDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [pdfDialog, setPdfDialog] = useState(false);
  const [deactivateLinkDialog, setDeactivateLinkDialog] = useState(false);

  const isActive = !qr.link?.disabled;
  // Legacy QR codes without a tracking link can only be downloaded or deleted.
  const hasLink = Boolean(qr.link);
  // Codes made by a CSV import encode one of the workspace's own links, which deleting keeps.
  const sharesLink = Boolean(qr.link && !qr.link.isQrCode);
  const svgNote = svgNoteFor(qr);
  // Link codes and static codes with a saved style can be redrawn as SVG and PDF.
  const canRedraw = savedQrCodeSvgState(qr) !== null;
  const isStatic = staticTypeOf(qr) !== null && canRedraw;

  const toggleStatusMutation = api.qrCode.toggleStatus.useMutation({
    onSuccess: async () => {
      await revalidateRoute("/dashboard/qrcodes");
      setDeactivateLinkDialog(false);
    },
  });

  const resetStatsMutation = api.qrCode.resetStatistics.useMutation({
    onSuccess: async () => {
      await revalidateRoute("/dashboard/qrcodes");
      setResetStatsDialog(false);
    },
  });

  const deleteMutation = api.qrCode.delete.useMutation({
    onSuccess: async () => {
      await revalidateRoute("/dashboard/qrcodes");
      setDeleteDialog(false);
    },
  });

  const handleOpenEditDrawer = () => {
    setHasOpenedDrawer(true);
    setOpenEditDrawer(true);
  };

  const handleDownload = async () => {
    const image = qr.qrCode;
    const state = savedQrCodeSvgState(qr);
    if (!image && state) {
      // Codes made by a CSV import store no PNG; draw it from the saved style.
      trackEvent(POSTHOG_EVENTS.QR_CODE_DOWNLOADED, { format: "png" });
      try {
        const logoImage = state.logoImage ? await toDataUri(state.logoImage) : undefined;
        const png = await renderQrPng({ ...state, logoImage });
        saveBlob(new Blob([png], { type: "image/png" }), qrCodeFileName(qr.title));
      } catch (error) {
        clientLogger.warn(
          { err: error instanceof Error ? error : String(error), qrCodeId: qr.id },
          "QR code PNG render failed",
        );
        toast.error("Couldn't create the PNG. Please try again.");
      }
      return;
    }
    if (!image) {
      toast.error("QR code image is not available for download.");
      return;
    }
    trackEvent(POSTHOG_EVENTS.QR_CODE_DOWNLOADED, { format: "png" });
    // The stored R2 image is cross-origin without CORS headers, so neither `fetch` nor `download`
    // works on it directly; the same-origin route serves the stored file instead.
    try {
      const response = await fetch(`/api/qr-codes/${qr.id}/png`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      saveBlob(await response.blob(), qrCodeFileName(qr.title));
    } catch (error) {
      clientLogger.warn(
        { err: error instanceof Error ? error : String(error), qrCodeId: qr.id },
        "QR code download fell back to opening",
      );
      window.open(image, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownloadSvg = async () => {
    const state = savedQrCodeSvgState(qr);
    if (!state) return;
    trackEvent(POSTHOG_EVENTS.QR_CODE_DOWNLOADED, { format: "svg" });
    try {
      // The SVG embeds the logo, so read the stored image into a data URI first.
      const logoImage = state.logoImage ? await toDataUri(state.logoImage) : undefined;
      saveSvg(generateQRCodeSvg({ ...state, logoImage }), qrCodeFileName(qr.title, "svg"));
    } catch (error) {
      clientLogger.warn(
        { err: error instanceof Error ? error : String(error), qrCodeId: qr.id },
        "QR code SVG download failed",
      );
      toast.error("Couldn't create the SVG. Please try again.");
    }
  };

  const subject = sharesLink ? "link" : "QR code";
  const toggleStatus = () => {
    toast.promise(toggleStatusMutation.mutateAsync({ id: qr.id }), {
      loading: "Updating...",
      success: `${sharesLink ? "Link" : "QR code"} ${isActive ? "deactivated" : "activated"}`,
      error: "Failed to update",
    });
  };
  // Deactivating an import-made code takes its short link down everywhere, so confirm it first.
  const handleToggleStatus = () => {
    if (sharesLink && isActive) {
      setDeactivateLinkDialog(true);
      return;
    }
    toggleStatus();
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${qr.title || "QR code"}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 dark:text-muted-foreground transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
          >
            <IconDots size={16} stroke={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52 border-neutral-200 dark:border-border p-1"
          sideOffset={4}
        >
          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-muted-foreground">
            Edit & Manage
          </DropdownMenuLabel>
          {(hasLink || isStatic) && (
            <DropdownMenuItem
              onClick={handleOpenEditDrawer}
              className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
            >
              <IconPencil
                size={15}
                stroke={1.5}
                className="mr-2 text-neutral-400 dark:text-muted-foreground"
              />
              Edit QR code
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={handleDownload}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconDownload
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400 dark:text-muted-foreground"
            />
            Download PNG
          </DropdownMenuItem>
          {canRedraw && (
            <DropdownMenuItem
              onClick={handleDownloadSvg}
              className="items-start rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
            >
              <IconVector
                size={15}
                stroke={1.5}
                className="mr-2 mt-0.5 shrink-0 text-neutral-400 dark:text-muted-foreground"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                Download SVG
                {svgNote && (
                  <span className="text-[11px] leading-snug text-neutral-400 dark:text-muted-foreground">
                    {svgNote}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          )}
          {canRedraw && (
            <DropdownMenuItem
              onClick={() => setPdfDialog(true)}
              className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
            >
              <IconFileTypePdf
                size={15}
                stroke={1.5}
                className="mr-2 text-neutral-400 dark:text-muted-foreground"
              />
              Download PDF for print
            </DropdownMenuItem>
          )}
          {hasLink && (
            <DropdownMenuItem
              onClick={() => setShareStatsDialog(true)}
              className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
            >
              <IconShare
                size={15}
                stroke={1.5}
                className="mr-2 text-neutral-400 dark:text-muted-foreground"
              />
              Share stats
            </DropdownMenuItem>
          )}

          {hasLink && (
            <>
              <DropdownMenuSeparator className="my-1 bg-neutral-100 dark:bg-muted" />

              <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-muted-foreground">
                Settings
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={handleToggleStatus}
                className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
              >
                {isActive ? (
                  <>
                    <IconLinkOff
                      size={15}
                      stroke={1.5}
                      className="mr-2 text-neutral-400 dark:text-muted-foreground"
                    />
                    Deactivate {subject}
                  </>
                ) : (
                  <>
                    <IconLink
                      size={15}
                      stroke={1.5}
                      className="mr-2 text-neutral-400 dark:text-muted-foreground"
                    />
                    Activate {subject}
                  </>
                )}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator className="my-1 bg-neutral-100 dark:bg-muted" />

          {/* An import-made code's clicks are its link's, so they are reset from the link. */}
          {hasLink && !sharesLink && (
            <DropdownMenuItem
              onClick={() => setResetStatsDialog(true)}
              className="rounded-md px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-600"
            >
              <IconRefresh size={15} stroke={1.5} className="mr-2" />
              Reset statistics
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setDeleteDialog(true)}
            className="rounded-md px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-600"
          >
            <IconTrash size={15} stroke={1.5} className="mr-2" />
            Delete QR code
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {hasOpenedDrawer && (
        <EditQRCodeDrawer qr={qr} open={openEditDrawer} onClose={() => setOpenEditDrawer(false)} />
      )}

      {canRedraw && <DownloadPdfDialog qr={qr} open={pdfDialog} onOpenChange={setPdfDialog} />}

      {qr.link && (
        <ShareStatsDialog
          linkId={qr.link.id}
          open={shareStatsDialog}
          onOpenChange={setShareStatsDialog}
        />
      )}

      {/* Deactivate Shared Link Dialog */}
      <AlertDialog open={deactivateLinkDialog} onOpenChange={setDeactivateLinkDialog}>
        <AlertDialogContent className="max-w-sm border-neutral-200 dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-neutral-900 dark:text-foreground">
              Deactivate link?
            </AlertDialogTitle>
            <AlertDialogDescription className="break-all text-[13px] text-neutral-500 dark:text-neutral-400">
              This QR code uses your short link{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {qr.link?.domain}/{qr.link?.alias}
              </span>
              . Deactivating it stops the link from redirecting everywhere it is shared, not only
              from this QR code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                toggleStatus();
              }}
              disabled={toggleStatusMutation.isLoading}
              className="h-9 bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {toggleStatusMutation.isLoading ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Statistics Dialog */}
      <AlertDialog open={resetStatsDialog} onOpenChange={setResetStatsDialog}>
        <AlertDialogContent className="max-w-sm border-neutral-200 dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-neutral-900 dark:text-foreground">
              Reset statistics?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
              This will permanently delete all scan data for{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {qr.title || "this QR code"}
              </span>
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                toast.promise(resetStatsMutation.mutateAsync({ id: qr.id }), {
                  loading: "Resetting...",
                  success: "Statistics reset",
                  error: "Failed to reset",
                });
              }}
              disabled={resetStatsMutation.isLoading}
              className="h-9 bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {resetStatsMutation.isLoading ? "Resetting..." : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete QR Code Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="max-w-sm border-neutral-200 dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-neutral-900 dark:text-foreground">
              Delete QR code?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
              This will permanently delete{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {qr.title || "this QR code"}
              </span>
              {sharesLink
                ? ". Its short link and clicks stay in your links. This cannot be undone."
                : " and all its scan data. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                toast.promise(deleteMutation.mutateAsync({ id: qr.id }), {
                  loading: "Deleting...",
                  success: "QR code deleted",
                  error: "Failed to delete",
                });
              }}
              disabled={deleteMutation.isLoading}
              className="h-9 bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

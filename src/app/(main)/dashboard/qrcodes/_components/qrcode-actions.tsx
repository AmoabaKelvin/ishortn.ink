"use client";

import {
  IconDots,
  IconDownload,
  IconLink,
  IconLinkOff,
  IconPencil,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
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
import { api } from "@/trpc/react";

import { revalidateRoute } from "../../revalidate-homepage";
import { EditQRCodeDrawer } from "./edit-qrcode-drawer";

import type { RouterOutputs } from "@/trpc/shared";

type QRCodeActionsProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
};

export function QRCodeActions({ qr }: QRCodeActionsProps) {
  const [hasOpenedDrawer, setHasOpenedDrawer] = useState(false);
  const [openEditDrawer, setOpenEditDrawer] = useState(false);
  const [resetStatsDialog, setResetStatsDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

  const isActive = !qr.link?.disabled;

  const toggleStatusMutation = api.qrCode.toggleStatus.useMutation({
    onSuccess: async () => {
      await revalidateRoute("/dashboard/qrcodes");
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

  const handleDownload = () => {
    if (!qr.qrCode) {
      toast.error("QR code image is not available for download.");
      return;
    }
    const a = document.createElement("a");
    a.href = qr.qrCode;
    a.download = qr.title ?? "qr-code";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    trackEvent(POSTHOG_EVENTS.QR_CODE_DOWNLOADED);
  };

  const handleToggleStatus = () => {
    toast.promise(toggleStatusMutation.mutateAsync({ id: qr.id }), {
      loading: "Updating...",
      success: isActive ? "QR code deactivated" : "QR code activated",
      error: "Failed to update",
    });
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
          >
            <IconDots size={16} stroke={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52 border-neutral-200 dark:border-border p-1"
          sideOffset={4}
        >
          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Edit & Manage
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={handleOpenEditDrawer}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconPencil
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400 dark:text-neutral-500"
            />
            Edit QR code
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDownload}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconDownload
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400 dark:text-neutral-500"
            />
            Download
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-neutral-100 dark:bg-muted" />

          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
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
                  className="mr-2 text-neutral-400 dark:text-neutral-500"
                />
                Deactivate QR code
              </>
            ) : (
              <>
                <IconLink
                  size={15}
                  stroke={1.5}
                  className="mr-2 text-neutral-400 dark:text-neutral-500"
                />
                Activate QR code
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-neutral-100 dark:bg-muted" />

          <DropdownMenuItem
            onClick={() => setResetStatsDialog(true)}
            className="rounded-md px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-600"
          >
            <IconRefresh size={15} stroke={1.5} className="mr-2" />
            Reset statistics
          </DropdownMenuItem>
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
        <EditQRCodeDrawer
          qr={qr}
          open={openEditDrawer}
          onClose={() => setOpenEditDrawer(false)}
        />
      )}

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
                toast.promise(
                  resetStatsMutation.mutateAsync({ id: qr.id }),
                  {
                    loading: "Resetting...",
                    success: "Statistics reset",
                    error: "Failed to reset",
                  },
                );
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
              </span>{" "}
              and all its scan data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                toast.promise(
                  deleteMutation.mutateAsync({ id: qr.id }),
                  {
                    loading: "Deleting...",
                    success: "QR code deleted",
                    error: "Failed to delete",
                  },
                );
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

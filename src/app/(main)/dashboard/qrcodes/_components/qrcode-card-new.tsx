"use client";

import { motion } from "framer-motion";
import {
  IconClick,
  IconDownload,
  IconExternalLink,
  IconTrash,
} from "@tabler/icons-react";
import { Link } from "next-view-transitions";
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
import { daysSinceDate } from "@/lib/utils";
import { api } from "@/trpc/react";

import { revalidateRoute } from "../../revalidate-homepage";

import type { RouterOutputs } from "@/trpc/shared";

type QRCodeCardProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
  index: number;
};

export function QRCodeCard({ qr, index }: QRCodeCardProps) {
  const [deleteDialog, setDeleteDialog] = useState(false);
  const deleteQrMutation = api.qrCode.delete.useMutation({
    onSuccess: async () => {
      await revalidateRoute("/dashboard/qrcodes");
    },
  });

  const daysSinceCreation = daysSinceDate(new Date(qr.createdAt!));
  const scans = qr.visitCount ?? 0;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = qr.qrCode!;
    link.download = qr.title ?? "qr-code";
    link.click();
    trackEvent(POSTHOG_EVENTS.QR_CODE_DOWNLOADED);
  };

  const handleDelete = async () => {
    try {
      await toast.promise(deleteQrMutation.mutateAsync({ id: qr.id }), {
        loading: "Deleting QR Code",
        success: "QR Code deleted successfully",
        error: "Failed to delete QR Code",
      });
      setDeleteDialog(false);
    } catch {
      // Error is already handled by toast.promise
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <div className="group relative px-1 py-4 transition-colors">
        <div className="flex items-center gap-4">
          {/* QR Code Thumbnail */}
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-white p-1.5 transition-all duration-200 group-hover:border-neutral-200 group-hover:shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.qrCode!}
              alt="QR Code"
              className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
            />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-medium text-neutral-900">
                {qr.title || "Untitled QR Code"}
              </span>
            </div>

            {/* Metadata row */}
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
              <span className="text-neutral-400">
                {daysSinceCreation === 0
                  ? "Today"
                  : `${daysSinceCreation}d`}
              </span>

              <span className="text-neutral-300">&middot;</span>

              {qr.link ? (
                <Link
                  href={`/dashboard/qrcodes/${qr.id}`}
                  className="inline-flex items-center gap-1 text-neutral-500 underline-offset-2 transition-colors hover:text-neutral-900 hover:underline"
                >
                  <span className="max-w-[200px] truncate sm:max-w-[300px]">
                    {qr.link.url}
                  </span>
                  <IconExternalLink
                    size={12}
                    stroke={1.5}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              ) : (
                <span className="max-w-[200px] truncate text-neutral-500 sm:max-w-[300px]">
                  {qr.content}
                </span>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/dashboard/qrcodes/${qr.id}`}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] tabular-nums text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              <IconClick size={14} stroke={1.5} />
              <span className="font-medium">{scans}</span>
            </Link>

            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={handleDownload}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
              >
                <IconDownload size={14} stroke={1.5} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteDialog(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <IconTrash size={14} stroke={1.5} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px] font-semibold text-neutral-900">
              Delete QR Code?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] text-neutral-500">
              This will permanently delete{" "}
              <span className="font-medium text-neutral-700">
                {qr.title || "this QR Code"}
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border-neutral-200 text-[13px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteQrMutation.isLoading}
              className="rounded-lg bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteQrMutation.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

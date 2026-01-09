"use client";

import { Download, ExternalLink, Link2, MousePointerClick, Trash2, Type } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { daysSinceDate } from "@/lib/utils";
import { api } from "@/trpc/react";

import { UpdateLinkModal } from "../../_components/links/link-card/update-modal";
import { revalidateRoute } from "../../revalidate-homepage";

import type { RouterOutputs } from "@/trpc/shared";

type QRCodeCardProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
};

function isALink(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

export function QRCodeCard({ qr }: QRCodeCardProps) {
  const [openLinkUpdateModal, setOpenLinkUpdateModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const deleteQrMutation = api.qrCode.delete.useMutation({
    onSuccess: async () => {
      await revalidateRoute("/dashboard/qrcodes");
    },
  });

  const daysSinceCreation = daysSinceDate(new Date(qr.createdAt!));
  const scans = isALink(qr.content) && qr.link ? qr.link.linkVisits.length : 0;

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
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className="flex items-start p-4 gap-4">
        {/* QR Code Image */}
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-gray-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr.qrCode!}
            alt="QR Code"
            className="h-full w-full object-contain"
          />
        </div>

        {/* QR Code Details */}
        <div className="flex flex-1 flex-col min-w-0 gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-gray-900 truncate text-sm">
                {qr.title || "Untitled QR Code"}
              </h3>
              {isALink(qr.content) && qr.link ? (
                <Link
                  href={`/dashboard/analytics/${qr.link.alias}?domain=${qr.link.domain ?? "ishortn.ink"}`}
                  className="group/link inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 transition-colors mt-0.5"
                >
                  <span className="truncate max-w-[180px]">
                    {(qr.link.domain ?? "ishortn.ink")}/{qr.link.alias}
                  </span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                </Link>
              ) : (
                <p className="text-xs text-gray-500 truncate mt-0.5 max-w-[200px]">{qr.content}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="h-7 w-7 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialog(true)}
                className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="rounded-md h-6 px-2 bg-gray-50/80 border-gray-200/80 font-normal"
            >
              {isALink(qr.content) ? (
                <>
                  <Link2 className="h-3 w-3 mr-1 text-blue-500" />
                  <span className="text-gray-600 text-[11px]">Link</span>
                </>
              ) : (
                <>
                  <Type className="h-3 w-3 mr-1 text-purple-500" />
                  <span className="text-gray-600 text-[11px]">Text</span>
                </>
              )}
            </Badge>

            {isALink(qr.content) && (
              <Badge
                variant="outline"
                className="rounded-md h-6 px-2 bg-gray-50/80 border-gray-200/80 font-normal"
              >
                <MousePointerClick className="h-3 w-3 mr-1 text-emerald-500" />
                <span className="text-gray-600 text-[11px]">{scans} scans</span>
              </Badge>
            )}

            <span className="text-[11px] text-gray-400 ml-auto">
              {daysSinceCreation === 0 ? "Today" : `${daysSinceCreation}d ago`}
            </span>
          </div>
        </div>
      </div>

      {qr.link && (
        <UpdateLinkModal
          open={openLinkUpdateModal}
          setOpen={setOpenLinkUpdateModal}
          link={{ ...qr.link, totalClicks: 0, tags: qr.link.tags ?? [], folder: null }}
        />
      )}

      {/* Delete QR Code Confirmation Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent className="max-w-md rounded-2xl border-0 p-0 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-b from-red-50 to-white p-6">
            <AlertDialogHeader className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-center text-lg font-semibold text-gray-900">
                Delete QR Code?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-sm text-gray-500">
                This will permanently delete <span className="font-medium text-gray-700">{qr.title || "this QR Code"}</span>. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="flex-row gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
            <AlertDialogCancel className="flex-1 rounded-xl border-gray-200 font-medium hover:bg-gray-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteQrMutation.isLoading}
              className="flex-1 rounded-xl bg-red-600 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteQrMutation.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}




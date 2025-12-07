"use client";

import { Download, Trash2 } from "lucide-react";
import { Link } from "next-view-transitions";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { copyToClipboard, daysSinceDate } from "@/lib/utils";
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
  };

  const handleDelete = async () => {
    toast.promise(deleteQrMutation.mutateAsync({ id: qr.id }), {
      loading: "Deleting QR Code",
      success: "QR Code deleted successfully",
      error: "Failed to delete QR Code",
    });
  };

  const handleCopy = async () => {
    if (isALink(qr.content) && qr.link) {
      await copyToClipboard(`https://ishortn.ink/${qr.link.alias}`);
    } else {
      await copyToClipboard(qr.content);
    }
  };

  return (
    <Card className="group relative overflow-hidden rounded-lg border border-gray-200 bg-card transition-all hover:shadow-sm">
      <div className="flex items-start p-5 gap-5">
        {/* QR Code Image */}
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-white p-2 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr.qrCode!}
            alt="QR Code"
            className="h-full w-full object-contain"
          />
        </div>

        {/* QR Code Details */}
        <div className="flex flex-1 flex-col min-w-0 gap-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100 truncate pr-4">
              {qr.title || "Untitled QR Code"}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isALink(qr.content) && qr.link ? (
            <Link
              href={`/dashboard/analytics/${qr.link.alias}`}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline truncate mb-3 block dark:text-blue-400 dark:hover:text-blue-300"
            >
              ishortn.ink/{qr.link.alias}
            </Link>
          ) : (
            <p className="text-sm text-slate-500 truncate mb-3">{qr.content}</p>
          )}

          <div className="flex items-center gap-3 mt-auto">
            <Badge variant="secondary" className="font-normal text-xs">
              {isALink(qr.content) ? "Link" : "Text"}
            </Badge>

            {isALink(qr.content) && (
              <div className="flex items-center text-xs text-slate-500">
                <span className="font-medium text-slate-900 dark:text-slate-100 mr-1">
                  {scans}
                </span>{" "}
                scans
              </div>
            )}

            <div className="flex items-center text-xs text-slate-400 ml-auto">
              {daysSinceCreation === 0
                ? "Created today"
                : `${daysSinceCreation}d ago`}
            </div>
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
    </Card>
  );
}





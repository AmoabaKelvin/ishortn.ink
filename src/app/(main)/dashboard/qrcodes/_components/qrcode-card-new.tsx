"use client";

import { Download, Link2, MousePointerClick, QrCode, Trash2, Type } from "lucide-react";
import { Link } from "next-view-transitions";
import { useState } from "react";
import { toast } from "sonner";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
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
    toast.promise(deleteQrMutation.mutateAsync({ id: qr.id }), {
      loading: "Deleting QR Code",
      success: "QR Code deleted successfully",
      error: "Failed to delete QR Code",
    });
  };

  return (
    <Card className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white transition-all hover:border-gray-200">
      <div className="flex items-start p-5 gap-5">
        {/* QR Code Image */}
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-white p-2">
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
            <h3 className="font-medium text-gray-900 truncate pr-4">
              {qr.title || "Untitled QR Code"}
            </h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isALink(qr.content) && qr.link ? (
            <Link
              href={`/dashboard/analytics/${qr.link.alias}`}
              className="text-sm text-gray-500 hover:text-gray-900 hover:underline underline-offset-2 truncate mb-2 block"
            >
              ishortn.ink/{qr.link.alias}
            </Link>
          ) : (
            <p className="text-sm text-gray-500 truncate mb-2">{qr.content}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="rounded-lg py-1.5 px-2.5 bg-gray-50 border-gray-200 font-normal hover:bg-gray-100 transition-colors"
            >
              {isALink(qr.content) ? (
                <>
                  <Link2 className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                  <span className="text-gray-700 font-medium text-xs">Link</span>
                </>
              ) : (
                <>
                  <Type className="h-3.5 w-3.5 mr-1.5 text-purple-500" />
                  <span className="text-gray-700 font-medium text-xs">Text</span>
                </>
              )}
            </Badge>

            {isALink(qr.content) && (
              <Badge
                variant="outline"
                className="rounded-lg py-1.5 px-2.5 bg-gray-50 border-gray-200 cursor-pointer font-normal hover:bg-gray-100 transition-colors"
              >
                <MousePointerClick className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                <span className="text-gray-700 font-medium text-xs">{scans}</span>
                <span className="ml-1 text-gray-400 text-xs">scans</span>
              </Badge>
            )}

            <span className="text-xs text-gray-400 ml-auto">
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
    </Card>
  );
}





"use client";
import {
	BarChart2,
	Calendar,
	Download,
	Link as LinkIcon,
	PencilLine,
	Trash2,
	Type,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/trpc/react";

import UpdateLinkModal from "../_components/single-link/update-link-modal";
import { revalidateRoute } from "../actions/revalidate-homepage";

import type { RouterOutputs } from "@/trpc/shared";
type QRCodeDisplayProps = {
  qr: RouterOutputs["qrCode"]["list"][number];
};

function isALink(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

const QRCodeDisplay = ({ qr }: QRCodeDisplayProps) => {
  const [openLinkUpdateModal, setOpenLinkUpdateModal] = useState(false);
  const deleteQrMutation = api.qrCode.delete.useMutation({
    onSuccess: async () => {
      await revalidateRoute("/dashboard/qrcodes");
    },
  });

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

  return (
    <div className="flex flex-col items-start space-y-4 rounded-lg bg-white p-4 shadow-sm sm:flex-row sm:space-x-4 sm:space-y-0">
      <div className="h-32 w-full flex-shrink-0 overflow-hidden rounded-lg border-4 border-gray-200 p-1 sm:w-32">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${qr.qrCode}`} alt="QR Code" className="h-full w-full object-cover" />
      </div>
      <div className="w-full flex-grow">
        <div className="flex items-start justify-between sm:flex-row">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 md:text-2xl">
              {qr.title ?? "No Title"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Content Type:{" "}
              {isALink(qr.content) ? <span className="text-black">Link</span> : "Text"}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              className="rounded-full hover:bg-gray-100"
              onClick={() => setOpenLinkUpdateModal(true)}
            >
              <PencilLine size={20} className="text-gray-500" />
            </button>
            <button
              type="button"
              className="rounded-full p-2 hover:bg-gray-100"
              onClick={handleDownload}
            >
              <Download size={20} className="text-gray-500" />
            </button>
            <button
              type="button"
              className="group rounded-full hover:bg-gray-100"
              onClick={handleDelete}
            >
              <Trash2 size={20} className="text-gray-500 group-hover:text-red-500" />
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500 sm:mt-12 sm:text-base">
          {isALink(qr.content) && qr.link && (
            <span className="flex items-center">
              <BarChart2 size={16} className="mr-1" />
              {qr.link?.linkVisits.length} scans
            </span>
          )}
          <span className="flex items-center">
            <Calendar size={16} className="mr-1" />
            {new Date(qr.createdAt!).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span className="flex items-center break-all">
            {isALink(qr.content) ? (
              <>
                <LinkIcon size={16} className="mr-1 flex-shrink-0" />
                https://ishortn.ink/{qr.link?.alias}
              </>
            ) : (
              <>
                <Type className="flex-shrink-0" />
                {qr.content.slice(0, 100)}
              </>
            )}
          </span>
        </div>
      </div>

      <UpdateLinkModal
        open={openLinkUpdateModal}
        setOpen={setOpenLinkUpdateModal}
        link={{ ...qr.link!, totalClicks: 0 }}
      />
    </div>
  );
};

export default QRCodeDisplay;

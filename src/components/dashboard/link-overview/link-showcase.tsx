"use client";

import { Prisma } from "@prisma/client";
import { BarChart3, ClipboardList, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  deleteLink,
  disableLink,
  enableLink,
  toggleLinkStats,
} from "@/actions/link-actions";
import { LinkActions } from "@/components/dashboard/link-overview/link-actions";
import { Badge } from "@/components/ui/badge";

import { LinkEditModal } from "../modals/link-edit-modal";
import { QRCodeModal } from "../modals/qr-code-modal";

type Link = Prisma.LinkGetPayload<{
  include: {
    linkVisits: true;
  };
}>;

// Function to handle the response check
const checkResponse = (response: any) => {
  return response && "id" in response;
};

const showToast = (
  action: "activated" | "deactivated" | "deleted",
  success: boolean,
) => {
  const titles = {
    activated: "Link activated",
    deactivated: "Link deactivated",
    deleted: "Link deleted",
  };
  const descriptions = {
    activated: "Your link has been activated.",
    deactivated: "Your link has been deactivated.",
    deleted: "Your link has been deleted.",
  };
  const errorMessages = {
    activated: "An error occurred while activating your link.",
    deactivated: "An error occurred while deactivating your link.",
    deleted: "An error occurred while deleting your link.",
  };

  if (success) {
    toast.success(titles[action], {
      description: descriptions[action],
    });
  } else {
    toast.error(errorMessages[action]);
  }
};

const LinkShowcase = ({ link }: { link: Link }) => {
  const router = useRouter();

  const [openModal, setOpenModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);

  const daysSinceToday = Math.floor(
    (new Date().getTime() - new Date(link.createdAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const handleModal = () => {
    setOpenModal(!openModal);
  };

  const handleQRCodeModal = () => {
    setQrModal(!qrModal);
  };

  const handleLinkDeletion = async () => {
    const response = await deleteLink(link.id);
    showToast("deleted", checkResponse(response));
  };

  const handleLinkDisabling = async () => {
    const response = await disableLink(link.id);
    showToast("deactivated", checkResponse(response));
  };

  const handleLinkEnabling = async () => {
    const response = await enableLink(link.id);
    showToast("activated", checkResponse(response));
  };

  const handleLinkPublicToggle = async (toggle: boolean) => {
    const response = await toggleLinkStats(link.id, toggle);

    if (response && "id" in response) {
      toast.success("Public Stats updated", {
        description: "Public stats setting has been updated",
        icon: <BarChart3 className="w-4 h-4" />,
      });
    }
  };

  const copyPublicLinkAnalyticsToClipboard = () => {
    window.navigator.clipboard.writeText(
      "https://ishortn.ink/analytics/" + link.alias,
    );
    toast.success("Public Stats Link Copied", {
      icon: <ClipboardList className="w-4 h-4" />,
    });
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 rounded-md bg-slate-50 "  >
      <div className="flex flex-col gap-2" style={{width:"80%"}}>
        <div className="flex items-center gap-3">
          <p
            className="flex items-center text-blue-600 cursor-pointer hover:underline"
            onClick={() => router.push(`/dashboard/analytics/${link.alias}`)}
          >
            {/* <span className="inline-block w-2 h-2 mr-2 bg-blue-300 rounded-full animate-pulse"></span> */}
            {link.disabled ? (
              <span className="inline-block w-2 h-2 mr-2 bg-red-300 rounded-full animate-pulse"></span>
            ) : (
              <span className="inline-block w-2 h-2 mr-2 bg-blue-300 rounded-full animate-pulse"></span>
            )}
            ishortn.ink/{link.alias}
          </p>
          <div className="flex items-center justify-center w-6 h-6 bg-white rounded-full cursor-pointer hover:animate-wiggle-more ">
            <Copy
              className="w-3 h-3"
              onClick={() => {
                window.navigator.clipboard.writeText(
                  `ishortn.ink/${link.alias}`,
                );
                toast.success("Link copied to clipboard", {
                  icon: <ClipboardList />,
                });
              }}
            />
          </div>
        </div>
        <p className="text-sm text-gray-500" style={{width:"100%"}}>
          <span>
            {/* Only show the days since today */}
            {daysSinceToday === 0 ? "Today" : `${daysSinceToday}d`}
          </span>
          <span className="mx-1 text-slate-300">•</span>
          <span className="text-gray-900 cursor-pointer hover:underline"  style={{width: '100%', overflowWrap: 'break-word' }}>
            {link.url}
            
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="transition-all duration-500 rounded-md bg-slate-100 hover:scale-110"
        >
          {link.linkVisits.length}
          <span className="hidden ml-0.5 md:inline">visits</span>
          <span className="inline ml-0.5 md:hidden">v</span>
        </Badge>

        <LinkActions
          handleDelete={handleLinkDeletion}
          handleModal={handleModal}
          handleQRCodeModal={handleQRCodeModal}
          handleDisable={handleLinkDisabling}
          isLinkActive={!link.disabled}
          handleEnable={handleLinkEnabling}
          handleLinkPublicToggle={handleLinkPublicToggle}
          isLinkStatsPublic={link.publicStats}
          copyPublicLinkAnalyticsToClipboard={
            copyPublicLinkAnalyticsToClipboard
          }
        />

        <LinkEditModal
          link={{ ...link, linkVisits: undefined }}
          open={openModal}
          setOpen={setOpenModal}
          linkId={link.id}
        />

        <QRCodeModal
          open={qrModal}
          setOpen={setQrModal}
          destinationUrl={`https://ishortn.ink/${link.alias}`}
        />
      </div>
    </div>
  );
};

export default LinkShowcase;

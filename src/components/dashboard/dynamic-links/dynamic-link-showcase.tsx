"use client";

import { Prisma } from "@prisma/client";
import { ClipboardList, Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteDynamicLinkChildLink } from "@/actions/dynamic-links-actions";
import { LinkActions } from "@/components/dashboard/link-overview/link-actions";

import { QRCodeModal } from "../modals/qr-code-modal";

type Link = Prisma.DynamicLinkGetPayload<{
  include: {
    childLinks: true;
  };
}>;

const DynamicLinksShowCase = ({ link }: { link: Link }) => {
  const router = useRouter();
  const [qrModal, setQrModal] = useState(false);

  const daysSinceToday = Math.floor(
    (new Date().getTime() - new Date(link.createdAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const handleModal = (id: number) => {
    router.push(`/dashboard/links/dynamic/create?id=${id}`);
  };

  const handleQRCodeModal = () => {
    setQrModal(!qrModal);
  };

  const handleLinkDeletion = async (id: number) => {
    const response = await deleteDynamicLinkChildLink(id);
    if (response && "id" in response) {
      toast.message("Your link has been deleted.", {
        icon: <Trash2 className="w-4 h-4" />,
      });
    } else {
      toast.error("An error occurred while deleting your link.");
    }
  };

  return (
    <>
      {link.childLinks.map((childLink) => (
        <div
          className="flex items-center justify-between px-6 py-4 rounded-md bg-slate-50"
          key={childLink.id}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <p className="flex items-center text-blue-600 cursor-pointer hover:underline">
                <span className="inline-block w-2 h-2 mr-2 bg-blue-300 rounded-full animate-pulse"></span>
                {link.subdomain}.ishortn.ink/{childLink.shortLink}
              </p>
              <div className="flex items-center justify-center w-6 h-6 bg-white rounded-full cursor-pointer hover:animate-wiggle-more ">
                <Copy
                  className="w-3 h-3"
                  onClick={() => {
                    window.navigator.clipboard.writeText(
                      `https://${link.subdomain}.ishortn.ink/${childLink.shortLink}`,
                    );
                    toast.success("Link copied to clipboard", {
                      icon: <ClipboardList className="w-4 h-4" />,
                    });
                  }}
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              <span>
                {/* Only show the days since today */}
                {daysSinceToday === 0 ? "Today" : `${daysSinceToday}d`}
              </span>
              <span className="mx-1 text-slate-300">•</span>
              <span className="text-gray-900 cursor-pointer hover:underline">
                {childLink.link}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LinkActions
              handleDelete={() => handleLinkDeletion(childLink.id)}
              handleModal={() => handleModal(childLink.id)}
              handleQRCodeModal={handleQRCodeModal}
            />

            <QRCodeModal
              open={qrModal}
              setOpen={setQrModal}
              destinationUrl={`${link.subdomain}.ishortn.ink/${childLink.shortLink}`}
            />
          </div>
        </div>
      ))}
    </>
  );
};

export default DynamicLinksShowCase;

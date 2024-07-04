"use client";

import { Copy, MoreVertical, Pencil, PowerCircle, QrCode, Trash2Icon, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode.react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyToClipboard, daysSinceDate } from "@/lib/utils";
import { api } from "@/trpc/react";

import { revalidateHomepage } from "../actions/revalidate-homepage";
import UpdateLinkModal from "./update-link-modal";

import type { RouterOutputs } from "@/trpc/shared";
type LinkProps = {
  link: RouterOutputs["link"]["list"][number];
};

const Link = ({ link }: LinkProps) => {
  const router = useRouter();

  const daysSinceLinkCreation = daysSinceDate(new Date(link.createdAt!));

  return (
    <div className="flex items-center justify-between rounded-md bg-gray-100/65 px-6 py-4 dark:bg-[#1B1B1B]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div
            className="flex cursor-pointer items-center text-blue-600 hover:underline"
            onClick={() => router.push(`/dashboard/analytics/${link.alias}`)}
          >
            <LinkStatus disabled={link.disabled!} />
            ishortn.ink/{link.alias}
          </div>
          <div
            className="hover:animate-wiggle-more flex h-6 w-6 cursor-pointer items-center justify-center rounded-full"
            onClick={async () => {
              await copyToClipboard(`https://ishortn.ink/${link.alias}`);
            }}
          >
            <Copy className="h-3 w-3" />
          </div>
        </div>
        <p className="text-sm">
          <span>{daysSinceLinkCreation === 0 ? "Today" : `${daysSinceLinkCreation}d`}</span>
          <span className="mx-1">•</span>
          <span className="cursor-pointer hover:underline">{link.url}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="rounded-md bg-card transition-all duration-500 hover:scale-110"
        >
          {link.totalClicks}
          <span className="ml-0.5 hidden md:inline">visits</span>
          <span className="ml-0.5 inline md:hidden">v</span>
        </Badge>
        <LinkActions link={link} />
      </div>
    </div>
  );
};

export default Link;

function LinkStatus({ disabled }: { disabled: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${disabled ? "text-red-500" : "text-blue-500"}`}>
      {disabled ? (
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-red-300"></span>
      ) : (
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-300"></span>
      )}
    </div>
  );
}

type LinkActionsProps = {
  link: RouterOutputs["link"]["list"][number];
};

const LinkActions = ({ link }: LinkActionsProps) => {
  const [openEditModal, setOpenEditModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const isPublicStatsEnabled = link.publicStats!;
  const isLinkActive = !link.disabled!;

  const togglePublicStatMutation = api.link.togglePublicStats.useMutation({
    onSuccess: async () => {
      toast.success("Public Stats toggled successfully");
      await revalidateHomepage();
    },
  });
  const toggleLinkStatusMutation = api.link.toggleLinkStatus.useMutation({
    onSuccess: async () => {
      toast.success("Link status toggled successfully");
      await revalidateHomepage();
    },
  });

  const deleteLinkMutation = api.link.delete.useMutation({
    onSuccess: async () => {
      toast.success("Link deleted successfully");
      await revalidateHomepage();
    },
  });

  const copyPublicStatsLink = async () => {
    await copyToClipboard(`https://ishortn.ink/${link.alias}/stats`);
  };

  const handleLinkToggleMutation = async () => {
    toggleLinkStatusMutation.mutate({ alias: link.alias! });
  };

  const handlePublicStatsToggleMutation = async () => {
    togglePublicStatMutation.mutate({ alias: link.alias! });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <MoreVertical className="size-4 cursor-pointer" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setOpenEditModal(true)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setQrModal(true)}>
              <QrCode className="mr-2 size-4" />
              QR Code
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePublicStatsToggleMutation}>
              <PowerCircle className="mr-2 size-4" />
              {isPublicStatsEnabled ? "Disable" : "Enable"} Public Stats
            </DropdownMenuItem>
            {isPublicStatsEnabled && (
              <DropdownMenuItem onClick={copyPublicStatsLink}>
                <Copy className="mr-2 size-4" />
                Copy Public Stats Link
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleLinkToggleMutation}>
              <Unlink className="mr-2 size-4" />
              {isLinkActive ? "Deactivate" : "Activate"} Link
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-500"
              onClick={() => deleteLinkMutation.mutate({ alias: link.alias! })}
            >
              <Trash2Icon className="mr-2 size-4" />
              Delete Link
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdateLinkModal link={link} open={openEditModal} setOpen={setOpenEditModal} />
      <QRCodeModal
        open={qrModal}
        setOpen={setQrModal}
        destinationUrl={`https://ishortn.ink/${link.alias}`}
      />
    </>
  );
};

type QRCodeModalProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  destinationUrl: string;
};

function QRCodeModal({ open, setOpen, destinationUrl }: QRCodeModalProps) {
  const qrCodeCanvasRef = useRef(null);

  const handleQRCodeDownload = () => {
    if (!destinationUrl) return;
    const canvas = document.getElementById("qr-gen") as HTMLCanvasElement;
    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `qrcode.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>QR Code</DialogTitle>
          <DialogDescription>Here is your QR Code for the link.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center">
          <QRCode
            id="qr-gen"
            value={destinationUrl}
            size={300}
            level={"H"}
            includeMargin={true}
            ref={qrCodeCanvasRef}
          />

          {/* Deactivate after Number of clicks */}
          <Button className="mt-4" onClick={handleQRCodeDownload}>
            Download Image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

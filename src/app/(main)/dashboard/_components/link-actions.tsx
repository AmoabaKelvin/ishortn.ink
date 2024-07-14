"use client";

import {
  Copy,
  KeyRound,
  MoreVertical,
  Pencil,
  PowerCircle,
  QrCode,
  RotateCcwIcon,
  Trash2Icon,
  Unlink,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyToClipboard } from "@/lib/utils";
import { api } from "@/trpc/react";

import { revalidateHomepage } from "../actions/revalidate-homepage";
import { ChangeLinkPasswordModal } from "./change-link-password-modal";
import { QRCodeModal } from "./qrcode-modal";
import UpdateLinkModal from "./update-link-modal";

import type { RouterOutputs } from "@/trpc/shared";

type LinkActionsProps = {
  link: RouterOutputs["link"]["list"][number];
};

export const LinkActions = ({ link }: LinkActionsProps) => {
  const [openEditModal, setOpenEditModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [openChangePasswordModal, setOpenChangePasswordModal] = useState(false);
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
      await revalidateHomepage();
    },
  });

  const resetLinksMutation = api.link.resetLinkStatistics.useMutation({
    onSuccess: async () => {
      await revalidateHomepage();
    },
  });

  const copyPublicStatsLink = async () => {
    await copyToClipboard(`https://ishortn.ink/analytics/${link.alias}/`);
  };

  const handleLinkToggleMutation = async () => {
    toast.promise(toggleLinkStatusMutation.mutateAsync({ id: link.id }), {
      loading: "Toggling Link Status...",
      success: "Link status toggled successfully",
      error: "Failed to toggle Link Status",
    });
  };

  const handlePublicStatsToggleMutation = async () => {
    toast.promise(togglePublicStatMutation.mutateAsync({ id: link.id }), {
      loading: "Toggling Public Stats...",
      success: "Public Stats toggled successfully",
      error: "Failed to toggle Public Stats",
    });
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
            <DropdownMenuSeparator />
            {link.passwordHash ? (
              <DropdownMenuItem
                className="text-red-500"
                onClick={() => setOpenChangePasswordModal(true)}
              >
                <KeyRound className="mr-2 size-4" />
                Change Password
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-blue-500"
                onClick={() => setOpenChangePasswordModal(true)}
              >
                <KeyRound className="mr-2 size-4" />
                Add Password
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-red-500 hover:cursor-pointer"
              onClick={() => {
                toast.promise(resetLinksMutation.mutateAsync({ id: link.id }), {
                  loading: "Resetting Statistics...",
                  success: "Link statistics reset successfully",
                  error: "Failed to reset Link Statistics",
                });
              }}
            >
              <RotateCcwIcon className="mr-2 size-4" />
              Reset Statistics
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-500"
              onClick={() => {
                toast.promise(deleteLinkMutation.mutateAsync({ id: link.id }), {
                  loading: "Deleting Link...",
                  success: "Link deleted successfully",
                  error: "Failed to delete Link",
                });
              }}
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
      <ChangeLinkPasswordModal
        open={openChangePasswordModal}
        setOpen={setOpenChangePasswordModal}
        id={link.id}
        hasPassword={!!link.passwordHash}
      />
    </>
  );
};

/* eslint-disable @typescript-eslint/no-unsafe-call */
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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyToClipboard, daysSinceDate } from "@/lib/utils";
import { api } from "@/trpc/react";

import { revalidateHomepage } from "../actions/revalidate-homepage";
import { ChangeLinkPasswordModal } from "./change-link-password-modal";
import { LinkSecurityStatusTooltip } from "./link-security-status-tooltip";
import { QRCodeModal } from "./qrcode-modal";
import UpdateLinkModal from "./update-link-modal";

import type { RouterOutputs } from "@/trpc/shared";
type LinkProps = {
  link: RouterOutputs["link"]["list"][number];
};

const Link = ({ link }: LinkProps) => {
  const router = useRouter();

  const daysSinceLinkCreation = daysSinceDate(new Date(link.createdAt!));

  return (
    <div className="flex items-center justify-between rounded-md bg-gray-100/65 px-6 py-4 dark:bg-[#0a1013]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div
            className="flex cursor-pointer items-center text-blue-600 hover:underline"
            onClick={() => router.push(`/dashboard/analytics/${link.alias}`)}
          >
            <LinkStatus disabled={link.disabled!} />
            <LinkSecurityStatusTooltip link={link} />
            ishortn.ink/{link.alias}
          </div>
          <div
            className="hover:animate-wiggle-more flex h-6 w-6 cursor-pointer items-center justify-center rounded-full"
            onClick={async () => {
              await copyToClipboard(`https://ishortn.ink/${link.alias}`);
            }}
          >
            <Copy className="h-3 w-3 text-foreground" />
          </div>
        </div>
        <p className="text-sm text-foreground">
          <span>{daysSinceLinkCreation === 0 ? "Today" : `${daysSinceLinkCreation}d`}</span>
          <span className="mx-1">•</span>
          <span className="cursor-pointer hover:underline">{link.url}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="rounded-md transition-all duration-500 hover:scale-110 hover:cursor-pointer"
          onClick={() => router.push(`/dashboard/analytics/${link.alias}`)}
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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const resetLinksMutation = api.link.resetLinkStatistics.useMutation({
    onSuccess: async () => {
      await revalidateHomepage();
    },
  });

  const copyPublicStatsLink = async () => {
    await copyToClipboard(`https://ishortn.ink/analytics/${link.alias}/`);
  };

  const handleLinkToggleMutation = async () => {
    toast.promise(toggleLinkStatusMutation.mutateAsync({ alias: link.alias! }), {
      loading: "Toggling Link Status...",
      success: "Link status toggled successfully",
      error: "Failed to toggle Link Status",
    });
  };

  const handlePublicStatsToggleMutation = async () => {
    toast.promise(togglePublicStatMutation.mutateAsync({ alias: link.alias! }), {
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
        <DropdownMenuContent className="bg-gray-100/65 dark:bg-[#0a1013]">
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
            {/* <DropdownMenuSeparator /> */}
            {link.passwordHash && (
              <>
                <DropdownMenuItem
                  className="text-red-500"
                  onClick={() => setOpenChangePasswordModal(true)}
                >
                  <KeyRound className="mr-2 size-4" />
                  Change Password
                </DropdownMenuItem>
                {/* <DropdownMenuSeparator /> */}
              </>
            )}
            <DropdownMenuItem
              className="text-red-500 hover:cursor-pointer"

              onClick={() => {
                toast.promise(resetLinksMutation.mutateAsync({ alias: link.alias! }), {
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
                toast.promise(deleteLinkMutation.mutateAsync({ alias: link.alias! }), {
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
        alias={link.alias!}
      />
    </>
  );
};

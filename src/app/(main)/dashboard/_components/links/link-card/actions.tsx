"use client";

import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Copy,
  FolderInput,
  KeyRound,
  MoreVertical,
  Pencil,
  PowerCircle,
  QrCode,
  RotateCcwIcon,
  Trash2Icon,
  Unlink,
} from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";
import { toast } from "sonner";

import { revalidateHomepage } from "@/app/(main)/dashboard/revalidate-homepage";
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

import { MoveToFolderModal } from "@/app/(main)/dashboard/folders/_components/move-to-folder-modal";

import { ChangeLinkPasswordModal } from "./password-change-modal";
import { QRCodeModal } from "./qrcode-modal";
import { UpdateLinkModal } from "./update-modal";

import type { RouterOutputs } from "@/trpc/shared";

type LinkActionsProps = {
  link: RouterOutputs["link"]["list"]["links"][number];
};

export const LinkActions = ({ link }: LinkActionsProps) => {
  const [openEditModal, setOpenEditModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [openChangePasswordModal, setOpenChangePasswordModal] = useState(false);
  const [moveToFolderModal, setMoveToFolderModal] = useState(false);
  const [resetStatsDialog, setResetStatsDialog] = useState(false);
  const [deleteLinkDialog, setDeleteLinkDialog] = useState(false);
  const isPublicStatsEnabled = link.publicStats!;
  const isLinkActive = !link.disabled!;
  const router = useTransitionRouter();

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

  const toggleArchive = api.link.toggleArchive.useMutation({
    onSuccess: (data) => {
      toast.success(data.archived ? "Link archived" : "Link restored");
      router.refresh();
    },
    onError: (error) => {
      toast.error("Error updating link status", {
        description: error.message,
      });
    },
  });

  const copyPublicStatsLink = async () => {
    await copyToClipboard(
      `https://ishortn.ink/analytics/${link.alias}?domain=${link.domain}`
    );
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

  const handleToggleArchive = () => {
    toast.promise(toggleArchive.mutateAsync({ id: link.id }), {
      loading: link.archived ? "Restoring link..." : "Archiving link...",
      success: (data) => {
        router.refresh();
        return data.archived ? "Link archived" : "Link restored";
      },
      error: "Failed to update link status",
    });
  };

  return (
    <>
      <DropdownMenu modal={false}>
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
            <DropdownMenuItem onClick={() => setMoveToFolderModal(true)}>
              <FolderInput className="mr-2 size-4" />
              Move to Folder
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
              onClick={() => setResetStatsDialog(true)}
            >
              <RotateCcwIcon className="mr-2 size-4" />
              Reset Statistics
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-500"
              onClick={() => setDeleteLinkDialog(true)}
            >
              <Trash2Icon className="mr-2 size-4" />
              Delete Link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleToggleArchive}>
              {link.archived ? (
                <>
                  <ArchiveRestore className="mr-2 h-4 w-4" /> Restore
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" /> Archive
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <UpdateLinkModal
        link={link}
        open={openEditModal}
        setOpen={setOpenEditModal}
      />
      <QRCodeModal
        open={qrModal}
        setOpen={setQrModal}
        destinationUrl={`https://${link.domain}/${link.alias}`}
      />
      <ChangeLinkPasswordModal
        open={openChangePasswordModal}
        setOpen={setOpenChangePasswordModal}
        id={link.id}
        hasPassword={!!link.passwordHash}
      />
      <MoveToFolderModal
        linkId={link.id}
        open={moveToFolderModal}
        onOpenChange={setMoveToFolderModal}
        currentFolderId={link.folderId}
      />

      {/* Reset Statistics Confirmation Dialog */}
      <AlertDialog open={resetStatsDialog} onOpenChange={setResetStatsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Reset Statistics
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to reset all statistics for{" "}
                <span className="font-semibold">{link.alias}</span>?
              </p>
              <p>This will permanently delete all click data and cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.promise(resetLinksMutation.mutateAsync({ id: link.id }), {
                  loading: "Resetting Statistics...",
                  success: "Link statistics reset successfully",
                  error: "Failed to reset Link Statistics",
                });
              }}
              disabled={resetLinksMutation.isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {resetLinksMutation.isLoading ? "Resetting..." : "Reset Statistics"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Link Confirmation Dialog */}
      <AlertDialog open={deleteLinkDialog} onOpenChange={setDeleteLinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Link
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold">{link.alias}</span>?
              </p>
              <p>This will permanently delete the link and all its statistics. This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.promise(deleteLinkMutation.mutateAsync({ id: link.id }), {
                  loading: "Deleting Link...",
                  success: "Link deleted successfully",
                  error: "Failed to delete Link",
                });
              }}
              disabled={deleteLinkMutation.isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLinkMutation.isLoading ? "Deleting..." : "Delete Link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

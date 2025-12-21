"use client";

import { motion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Copy,
  FolderInput,
  KeyRound,
  MoreHorizontal,
  Pencil,
  QrCode,
  RotateCcw,
  Trash2,
  Unlink,
  Link as LinkIcon,
  BarChart3,
} from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";
import { toast } from "sonner";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";

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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyToClipboard } from "@/lib/utils";
import { api } from "@/trpc/react";

import { MoveToFolderModal } from "@/app/(main)/dashboard/folders/_components/move-to-folder-modal";
import { TransferToWorkspaceModal } from "../transfer-to-workspace-modal";

import { ChangeLinkPasswordModal } from "./password-change-modal";
import { EditLinkDrawer } from "./edit-link-drawer";
import { QRCodeModal } from "./qrcode-modal";

import type { RouterOutputs } from "@/trpc/shared";

type LinkActionsProps = {
  link: RouterOutputs["link"]["list"]["links"][number];
};

export const LinkActions = ({ link }: LinkActionsProps) => {
  const [openEditModal, setOpenEditModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [openChangePasswordModal, setOpenChangePasswordModal] = useState(false);
  const [moveToFolderModal, setMoveToFolderModal] = useState(false);
  const [transferToWorkspaceModal, setTransferToWorkspaceModal] = useState(false);
  const [resetStatsDialog, setResetStatsDialog] = useState(false);
  const [deleteLinkDialog, setDeleteLinkDialog] = useState(false);
  const isPublicStatsEnabled = link.publicStats!;
  const isLinkActive = !link.disabled!;
  const router = useTransitionRouter();

  const togglePublicStatMutation = api.link.togglePublicStats.useMutation({
    onSuccess: async () => {
      toast.success("Public stats toggled");
      await revalidateHomepage();
    },
  });
  const toggleLinkStatusMutation = api.link.toggleLinkStatus.useMutation({
    onSuccess: async () => {
      toast.success("Link status toggled");
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
      loading: "Updating...",
      success: isLinkActive ? "Link deactivated" : "Link activated",
      error: "Failed to update link",
    });
  };

  const handlePublicStatsToggleMutation = async () => {
    toast.promise(togglePublicStatMutation.mutateAsync({ id: link.id }), {
      loading: "Updating...",
      success: isPublicStatsEnabled ? "Public stats disabled" : "Public stats enabled",
      error: "Failed to update",
    });
  };

  const handleToggleArchive = () => {
    toast.promise(toggleArchive.mutateAsync({ id: link.id }), {
      loading: link.archived ? "Restoring..." : "Archiving...",
      success: (data) => {
        router.refresh();
        return data.archived ? "Link archived" : "Link restored";
      },
      error: "Failed to update",
    });
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <motion.button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none"
            whileTap={{ scale: 0.95 }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </motion.button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 rounded-xl border-gray-200 p-1.5 shadow-lg"
          sideOffset={8}
        >
          {/* Edit & Share */}
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-gray-400">
            Edit & Share
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setOpenEditModal(true)}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            <Pencil className="mr-2.5 h-4 w-4 text-gray-400" />
            Edit link
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setQrModal(true)}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            <QrCode className="mr-2.5 h-4 w-4 text-gray-400" />
            QR code
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5 bg-gray-100" />

          {/* Organize */}
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-gray-400">
            Organize
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setMoveToFolderModal(true)}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            <FolderInput className="mr-2.5 h-4 w-4 text-gray-400" />
            Move to folder
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTransferToWorkspaceModal(true)}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            <ArrowRightLeft className="mr-2.5 h-4 w-4 text-gray-400" />
            Transfer to workspace
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleToggleArchive}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            {link.archived ? (
              <>
                <ArchiveRestore className="mr-2.5 h-4 w-4 text-gray-400" />
                Restore from archive
              </>
            ) : (
              <>
                <Archive className="mr-2.5 h-4 w-4 text-gray-400" />
                Archive
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5 bg-gray-100" />

          {/* Settings */}
          <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-gray-400">
            Settings
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={handleLinkToggleMutation}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            {isLinkActive ? (
              <>
                <Unlink className="mr-2.5 h-4 w-4 text-gray-400" />
                Deactivate link
              </>
            ) : (
              <>
                <LinkIcon className="mr-2.5 h-4 w-4 text-gray-400" />
                Activate link
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setOpenChangePasswordModal(true)}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            <KeyRound className="mr-2.5 h-4 w-4 text-gray-400" />
            {link.passwordHash ? "Change password" : "Add password"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handlePublicStatsToggleMutation}
            className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
          >
            <BarChart3 className="mr-2.5 h-4 w-4 text-gray-400" />
            {isPublicStatsEnabled ? "Disable public stats" : "Enable public stats"}
          </DropdownMenuItem>
          {isPublicStatsEnabled && (
            <DropdownMenuItem
              onClick={copyPublicStatsLink}
              className="rounded-lg px-2 py-2 text-sm font-medium text-gray-700 focus:bg-gray-100"
            >
              <Copy className="mr-2.5 h-4 w-4 text-gray-400" />
              Copy stats link
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="my-1.5 bg-gray-100" />

          {/* Danger Zone */}
          <DropdownMenuItem
            onClick={() => setResetStatsDialog(true)}
            className="rounded-lg px-2 py-2 text-sm font-medium text-red-600 focus:bg-red-50 focus:text-red-600"
          >
            <RotateCcw className="mr-2.5 h-4 w-4" />
            Reset statistics
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteLinkDialog(true)}
            className="rounded-lg px-2 py-2 text-sm font-medium text-red-600 focus:bg-red-50 focus:text-red-600"
          >
            <Trash2 className="mr-2.5 h-4 w-4" />
            Delete link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditLinkDrawer
        link={link}
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
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
      <TransferToWorkspaceModal
        linkIds={[link.id]}
        open={transferToWorkspaceModal}
        onOpenChange={setTransferToWorkspaceModal}
      />

      {/* Reset Statistics Confirmation Dialog */}
      <AlertDialog open={resetStatsDialog} onOpenChange={setResetStatsDialog}>
        <AlertDialogContent className="max-w-md rounded-2xl border-0 p-0 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-b from-amber-50 to-white p-6">
            <AlertDialogHeader className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <RotateCcw className="h-5 w-5 text-amber-600" />
              </div>
              <AlertDialogTitle className="text-center text-lg font-semibold text-gray-900">
                Reset statistics?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-sm text-gray-500">
                This will permanently delete all click data for <span className="font-medium text-gray-700">{link.alias}</span>. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="flex-row gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
            <AlertDialogCancel className="flex-1 rounded-xl border-gray-200 font-medium hover:bg-gray-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.promise(resetLinksMutation.mutateAsync({ id: link.id }), {
                  loading: "Resetting...",
                  success: "Statistics reset",
                  error: "Failed to reset",
                });
              }}
              disabled={resetLinksMutation.isLoading}
              className="flex-1 rounded-xl bg-amber-600 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {resetLinksMutation.isLoading ? "Resetting..." : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Link Confirmation Dialog */}
      <AlertDialog open={deleteLinkDialog} onOpenChange={setDeleteLinkDialog}>
        <AlertDialogContent className="max-w-md rounded-2xl border-0 p-0 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-b from-red-50 to-white p-6">
            <AlertDialogHeader className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-center text-lg font-semibold text-gray-900">
                Delete link?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-sm text-gray-500">
                This will permanently delete <span className="font-medium text-gray-700">{link.alias}</span> and all its analytics data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="flex-row gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
            <AlertDialogCancel className="flex-1 rounded-xl border-gray-200 font-medium hover:bg-gray-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.promise(deleteLinkMutation.mutateAsync({ id: link.id }), {
                  loading: "Deleting...",
                  success: () => {
                    trackEvent(POSTHOG_EVENTS.LINK_DELETED, {
                      alias: link.alias,
                      domain: link.domain,
                    });
                    return "Link deleted";
                  },
                  error: "Failed to delete",
                });
              }}
              disabled={deleteLinkMutation.isLoading}
              className="flex-1 rounded-xl bg-red-600 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteLinkMutation.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

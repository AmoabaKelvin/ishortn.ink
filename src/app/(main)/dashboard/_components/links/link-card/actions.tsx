"use client";

import { motion } from "framer-motion";
import {
  IconArchive,
  IconArchiveOff,
  IconArrowsExchange,
  IconChartBar,
  IconCopy,
  IconDots,
  IconFolderShare,
  IconKey,
  IconLink,
  IconLinkOff,
  IconPencil,
  IconQrcode,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
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
  const [transferToWorkspaceModal, setTransferToWorkspaceModal] =
    useState(false);
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
      `https://ishortn.ink/analytics/${link.alias}?domain=${link.domain}`,
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
      success: isPublicStatsEnabled
        ? "Public stats disabled"
        : "Public stats enabled",
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
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600 focus:outline-none"
          >
            <IconDots size={16} stroke={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-52 border-neutral-200 dark:border-border p-1"
          sideOffset={4}
        >
          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Edit & Share
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setOpenEditModal(true)}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconPencil
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400"
            />
            Edit link
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setQrModal(true)}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconQrcode
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400"
            />
            QR code
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-neutral-100 dark:bg-border" />

          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Organize
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setMoveToFolderModal(true)}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconFolderShare
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400"
            />
            Move to folder
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTransferToWorkspaceModal(true)}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconArrowsExchange
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400"
            />
            Transfer to workspace
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleToggleArchive}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            {link.archived ? (
              <>
                <IconArchiveOff
                  size={15}
                  stroke={1.5}
                  className="mr-2 text-neutral-400"
                />
                Restore from archive
              </>
            ) : (
              <>
                <IconArchive
                  size={15}
                  stroke={1.5}
                  className="mr-2 text-neutral-400"
                />
                Archive
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-neutral-100 dark:bg-border" />

          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Settings
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={handleLinkToggleMutation}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            {isLinkActive ? (
              <>
                <IconLinkOff
                  size={15}
                  stroke={1.5}
                  className="mr-2 text-neutral-400"
                />
                Deactivate link
              </>
            ) : (
              <>
                <IconLink
                  size={15}
                  stroke={1.5}
                  className="mr-2 text-neutral-400"
                />
                Activate link
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setOpenChangePasswordModal(true)}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconKey
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400"
            />
            {link.passwordHash ? "Change password" : "Add password"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handlePublicStatsToggleMutation}
            className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
          >
            <IconChartBar
              size={15}
              stroke={1.5}
              className="mr-2 text-neutral-400"
            />
            {isPublicStatsEnabled
              ? "Disable public stats"
              : "Enable public stats"}
          </DropdownMenuItem>
          {isPublicStatsEnabled && (
            <DropdownMenuItem
              onClick={copyPublicStatsLink}
              className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50 focus:text-neutral-900 dark:focus:text-foreground"
            >
              <IconCopy
                size={15}
                stroke={1.5}
                className="mr-2 text-neutral-400"
              />
              Copy stats link
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="my-1 bg-neutral-100 dark:bg-border" />

          <DropdownMenuItem
            onClick={() => setResetStatsDialog(true)}
            className="rounded-md px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-600 dark:focus:text-red-400"
          >
            <IconRefresh size={15} stroke={1.5} className="mr-2" />
            Reset statistics
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteLinkDialog(true)}
            className="rounded-md px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-600 dark:focus:text-red-400"
          >
            <IconTrash size={15} stroke={1.5} className="mr-2" />
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

      {/* Reset Statistics Dialog */}
      <AlertDialog open={resetStatsDialog} onOpenChange={setResetStatsDialog}>
        <AlertDialogContent className="max-w-sm border-neutral-200 dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-neutral-900 dark:text-foreground">
              Reset statistics?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
              This will permanently delete all click data for{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {link.alias}
              </span>
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.promise(
                  resetLinksMutation.mutateAsync({ id: link.id }),
                  {
                    loading: "Resetting...",
                    success: "Statistics reset",
                    error: "Failed to reset",
                  },
                );
              }}
              disabled={resetLinksMutation.isLoading}
              className="h-9 bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {resetLinksMutation.isLoading ? "Resetting..." : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Link Dialog */}
      <AlertDialog open={deleteLinkDialog} onOpenChange={setDeleteLinkDialog}>
        <AlertDialogContent className="max-w-sm border-neutral-200 dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-neutral-900 dark:text-foreground">
              Delete link?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
              This will permanently delete{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {link.alias}
              </span>{" "}
              and all its analytics data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toast.promise(
                  deleteLinkMutation.mutateAsync({ id: link.id }),
                  {
                    loading: "Deleting...",
                    success: () => {
                      trackEvent(POSTHOG_EVENTS.LINK_DELETED, {
                        alias: link.alias,
                        domain: link.domain,
                      });
                      return "Link deleted";
                    },
                    error: "Failed to delete",
                  },
                );
              }}
              disabled={deleteLinkMutation.isLoading}
              className="h-9 bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteLinkMutation.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

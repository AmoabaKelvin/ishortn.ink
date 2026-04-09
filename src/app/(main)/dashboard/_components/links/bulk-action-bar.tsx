"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  IconArchive,
  IconArchiveOff,
  IconChevronDown,
  IconFolderShare,
  IconLink,
  IconLinkOff,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/trpc/react";

import { MoveToFolderModal } from "@/app/(main)/dashboard/folders/_components/move-to-folder-modal";
import { TransferToWorkspaceModal } from "./transfer-to-workspace-modal";
import { useSelection } from "./selection-context";

export function BulkActionBar() {
  const { selectedLinkIds, clearSelection, exitSelectionMode } =
    useSelection();
  const [moveToFolderOpen, setMoveToFolderOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveAction, setArchiveAction] = useState<"archive" | "restore">(
    "archive",
  );
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<
    "activate" | "deactivate"
  >("deactivate");

  const utils = api.useUtils();

  const bulkDeleteMutation = api.link.bulkDelete.useMutation({
    onSuccess: async (result) => {
      await utils.link.list.invalidate();
      await revalidateHomepage();
      clearSelection();
      exitSelectionMode();
      setDeleteDialogOpen(false);
      toast.success(`${result.count} links deleted`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const bulkArchiveMutation = api.link.bulkArchive.useMutation({
    onSuccess: async (result) => {
      await utils.link.list.invalidate();
      await revalidateHomepage();
      clearSelection();
      exitSelectionMode();
      setArchiveDialogOpen(false);
      toast.success(
        `${result.count} links ${result.archived ? "archived" : "restored"}`,
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const bulkToggleStatusMutation = api.link.bulkToggleStatus.useMutation({
    onSuccess: async (result) => {
      await utils.link.list.invalidate();
      await revalidateHomepage();
      clearSelection();
      exitSelectionMode();
      setStatusDialogOpen(false);
      toast.success(
        `${result.count} links ${result.disabled ? "deactivated" : "activated"}`,
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate({ linkIds: selectedLinkIds });
  };

  const handleBulkArchive = () => {
    bulkArchiveMutation.mutate({
      linkIds: selectedLinkIds,
      archive: archiveAction === "archive",
    });
  };

  const handleBulkToggleStatus = () => {
    bulkToggleStatusMutation.mutate({
      linkIds: selectedLinkIds,
      disable: statusAction === "deactivate",
    });
  };

  const openArchiveDialog = (action: "archive" | "restore") => {
    setArchiveAction(action);
    setArchiveDialogOpen(true);
  };

  const openStatusDialog = (action: "activate" | "deactivate") => {
    setStatusAction(action);
    setStatusDialogOpen(true);
  };

  const handleMoveSuccess = () => {
    clearSelection();
    exitSelectionMode();
  };

  const handleTransferSuccess = () => {
    clearSelection();
    exitSelectionMode();
  };

  if (selectedLinkIds.length === 0) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-1 rounded-xl border border-neutral-200 dark:border-border bg-white dark:bg-card px-2 py-1.5 shadow-lg">
            {/* Count */}
            <div className="flex items-center gap-2 px-2.5 py-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600">
                <motion.span
                  key={selectedLinkIds.length}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-[11px] font-bold tabular-nums text-white"
                >
                  {selectedLinkIds.length}
                </motion.span>
              </div>
              <span className="text-[13px] font-medium text-neutral-500">
                selected
              </span>
            </div>

            <div className="h-5 w-px bg-neutral-200 dark:bg-border" />

            {/* Actions */}
            <div className="flex items-center gap-0.5 px-1">
              <button
                type="button"
                onClick={() => setMoveToFolderOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900 dark:hover:text-foreground"
              >
                <IconFolderShare size={15} stroke={1.5} />
                <span className="hidden sm:inline">Folder</span>
              </button>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-900 dark:hover:text-foreground"
                  >
                    <span className="hidden sm:inline">More</span>
                    <IconChevronDown size={14} stroke={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  className="w-48 border-neutral-200 dark:border-border p-1"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    Organize
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => setTransferOpen(true)}
                    className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50"
                  >
                    <IconFolderShare
                      size={15}
                      stroke={1.5}
                      className="mr-2 text-neutral-400"
                    />
                    Transfer to workspace
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openArchiveDialog("archive")}
                    className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50"
                  >
                    <IconArchive
                      size={15}
                      stroke={1.5}
                      className="mr-2 text-neutral-400"
                    />
                    Archive
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1 bg-neutral-100 dark:bg-border" />

                  <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    Settings
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => openStatusDialog("deactivate")}
                    className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50"
                  >
                    <IconLinkOff
                      size={15}
                      stroke={1.5}
                      className="mr-2 text-neutral-400"
                    />
                    Deactivate links
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => openStatusDialog("activate")}
                    className="rounded-md px-2 py-1.5 text-[13px] text-neutral-600 dark:text-neutral-400 focus:bg-neutral-50 dark:focus:bg-accent/50"
                  >
                    <IconLink
                      size={15}
                      stroke={1.5}
                      className="mr-2 text-neutral-400"
                    />
                    Activate links
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1 bg-neutral-100 dark:bg-border" />

                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="rounded-md px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-500/10 focus:text-red-600 dark:focus:text-red-400"
                  >
                    <IconTrash size={15} stroke={1.5} className="mr-2" />
                    Delete links
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="h-5 w-px bg-neutral-200 dark:bg-border" />

            <button
              type="button"
              onClick={exitSelectionMode}
              className="flex items-center justify-center rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-600"
            >
              <IconX size={15} stroke={1.5} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <MoveToFolderModal
        linkIds={selectedLinkIds}
        open={moveToFolderOpen}
        onOpenChange={(open) => {
          setMoveToFolderOpen(open);
          if (!open) handleMoveSuccess();
        }}
      />

      <TransferToWorkspaceModal
        linkIds={selectedLinkIds}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onSuccess={handleTransferSuccess}
      />

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-sm border-neutral-200 dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-neutral-900 dark:text-foreground">
              Delete {selectedLinkIds.length}{" "}
              {selectedLinkIds.length === 1 ? "link" : "links"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
              This will permanently delete{" "}
              {selectedLinkIds.length === 1 ? "this link" : "these links"} and
              all associated analytics data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isLoading}
              className="h-9 bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
            >
              {bulkDeleteMutation.isLoading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Dialog */}
      <AlertDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
      >
        <AlertDialogContent className="max-w-sm border-neutral-200 dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-neutral-900 dark:text-foreground">
              {archiveAction === "archive" ? "Archive" : "Restore"}{" "}
              {selectedLinkIds.length}{" "}
              {selectedLinkIds.length === 1 ? "link" : "links"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
              {archiveAction === "archive"
                ? `${selectedLinkIds.length === 1 ? "This link" : "These links"} will be archived. Archived links still work but are hidden from the main view.`
                : `${selectedLinkIds.length === 1 ? "This link" : "These links"} will be restored and visible again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkArchive}
              disabled={bulkArchiveMutation.isLoading}
              className="h-9 bg-blue-600 text-[13px] text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkArchiveMutation.isLoading
                ? archiveAction === "archive"
                  ? "Archiving..."
                  : "Restoring..."
                : archiveAction === "archive"
                  ? "Archive"
                  : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Dialog */}
      <AlertDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
      >
        <AlertDialogContent className="max-w-sm border-neutral-200 dark:border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold text-neutral-900 dark:text-foreground">
              {statusAction === "deactivate" ? "Deactivate" : "Activate"}{" "}
              {selectedLinkIds.length}{" "}
              {selectedLinkIds.length === 1 ? "link" : "links"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-neutral-500 dark:text-neutral-400">
              {statusAction === "deactivate"
                ? `${selectedLinkIds.length === 1 ? "This link" : "These links"} will be deactivated and will no longer redirect visitors.`
                : `${selectedLinkIds.length === 1 ? "This link" : "These links"} will be activated and start redirecting visitors again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-9 border-neutral-200 dark:border-border text-[13px] hover:bg-neutral-50 dark:hover:bg-accent/50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkToggleStatus}
              disabled={bulkToggleStatusMutation.isLoading}
              className="h-9 bg-blue-600 text-[13px] text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkToggleStatusMutation.isLoading
                ? statusAction === "deactivate"
                  ? "Deactivating..."
                  : "Activating..."
                : statusAction === "deactivate"
                  ? "Deactivate"
                  : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

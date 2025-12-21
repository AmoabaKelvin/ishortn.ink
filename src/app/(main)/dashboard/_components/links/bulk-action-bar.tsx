"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  FolderInput,
  Trash2,
  X,
} from "lucide-react";
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
import { api } from "@/trpc/react";

import { MoveToFolderModal } from "@/app/(main)/dashboard/folders/_components/move-to-folder-modal";
import { TransferToWorkspaceModal } from "./transfer-to-workspace-modal";
import { useSelection } from "./selection-context";

export function BulkActionBar() {
  const { selectedLinkIds, clearSelection, exitSelectionMode } = useSelection();
  const [moveToFolderOpen, setMoveToFolderOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate({ linkIds: selectedLinkIds });
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
          transition={{
            duration: 0.2,
            ease: [0.4, 0, 0.2, 1],
          }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-1 rounded-2xl bg-white px-2 py-2 shadow-xl shadow-gray-200/50 border border-gray-200">
            {/* Selection count */}
            <div className="flex items-center gap-2 px-3 py-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500">
                <motion.span
                  key={selectedLinkIds.length}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-sm font-bold text-white tabular-nums"
                >
                  {selectedLinkIds.length}
                </motion.span>
              </div>
              <span className="text-sm font-medium text-gray-600">
                selected
              </span>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-gray-200" />

            {/* Action buttons */}
            <div className="flex items-center gap-1 px-1">
              <motion.button
                type="button"
                onClick={() => setMoveToFolderOpen(true)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <FolderInput className="h-4 w-4" />
                <span className="hidden sm:inline">Folder</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setTransferOpen(true)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ArrowRight className="h-4 w-4" />
                <span className="hidden sm:inline">Transfer</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Delete</span>
              </motion.button>
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-gray-200" />

            {/* Close button */}
            <motion.button
              type="button"
              onClick={exitSelectionMode}
              className="flex items-center justify-center rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Move to Folder Modal */}
      <MoveToFolderModal
        linkIds={selectedLinkIds}
        open={moveToFolderOpen}
        onOpenChange={(open) => {
          setMoveToFolderOpen(open);
          if (!open) handleMoveSuccess();
        }}
      />

      {/* Transfer to Workspace Modal */}
      <TransferToWorkspaceModal
        linkIds={selectedLinkIds}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onSuccess={handleTransferSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-2xl border-0 p-0 overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-b from-red-50 to-white p-6">
            <AlertDialogHeader className="space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-center text-lg font-semibold text-gray-900">
                Delete {selectedLinkIds.length} {selectedLinkIds.length === 1 ? "link" : "links"}?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-sm text-gray-500">
                This will permanently delete {selectedLinkIds.length === 1 ? "this link" : "these links"} and all associated analytics data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter className="flex-row gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
            <AlertDialogCancel className="flex-1 rounded-xl border-gray-200 font-medium hover:bg-gray-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isLoading}
              className="flex-1 rounded-xl bg-red-600 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {bulkDeleteMutation.isLoading ? (
                <span className="flex items-center gap-2">
                  <motion.div
                    className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

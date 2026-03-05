"use client";

import { toast } from "sonner";

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

import type { RouterOutputs } from "@/trpc/shared";

type DeleteFolderDialogProps = {
  folder:
    | (RouterOutputs["folder"]["list"][number] | RouterOutputs["folder"]["get"])
    | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function DeleteFolderDialog({
  folder,
  open,
  onOpenChange,
  onSuccess,
}: DeleteFolderDialogProps) {
  const utils = api.useUtils();

  const deleteFolderMutation = api.folder.delete.useMutation({
    onSuccess: async () => {
      toast.success("Folder deleted successfully");
      await utils.folder.list.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDelete = () => {
    if (!folder) return;
    deleteFolderMutation.mutate({ id: folder.id });
  };

  if (!folder) return null;

  const linkCount =
    "linkCount" in folder ? folder.linkCount : folder.links.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[14px] font-semibold text-neutral-900">
            Delete Folder?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[12px] text-neutral-500">
            <span>
              This will permanently delete{" "}
              <span className="font-medium text-neutral-700">
                {folder.name}
              </span>
              . This action cannot be undone.
            </span>
            {linkCount > 0 && (
              <span className="mt-2 block text-amber-600">
                This folder contains {linkCount}{" "}
                {linkCount === 1 ? "link" : "links"}. The links will be moved
                out and won't be deleted.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg border-neutral-200 text-[13px]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleteFolderMutation.isLoading}
            className="rounded-lg bg-red-600 text-[13px] text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleteFolderMutation.isLoading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

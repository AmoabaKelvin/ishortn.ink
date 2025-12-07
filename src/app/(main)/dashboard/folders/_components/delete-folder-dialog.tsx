"use client";

import { AlertTriangle } from "lucide-react";
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
};

export function DeleteFolderDialog({
  folder,
  open,
  onOpenChange,
}: DeleteFolderDialogProps) {
  const utils = api.useUtils();

  const deleteFolderMutation = api.folder.delete.useMutation({
    onSuccess: async () => {
      toast.success("Folder deleted successfully");
      await utils.folder.list.invalidate();
      onOpenChange(false);
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

  // Get link count from either linkCount property or links array length
  const linkCount =
    "linkCount" in folder ? folder.linkCount : folder.links.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Delete Folder
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{folder.name}</span>?
            </p>
            {linkCount > 0 && (
              <p className="text-amber-600 font-medium">
                This folder contains {linkCount}{" "}
                {linkCount === 1 ? "link" : "links"}. The links will be moved to
                "Unfoldered" and won't be deleted.
              </p>
            )}
            <p>This action cannot be undone.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteFolderMutation.isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteFolderMutation.isLoading ? "Deleting..." : "Delete Folder"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

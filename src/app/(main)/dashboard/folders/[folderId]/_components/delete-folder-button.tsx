"use client";

import { Trash2 } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";

import { DeleteFolderDialog } from "@/app/(main)/dashboard/folders/_components/delete-folder-dialog";
import { Button } from "@/components/ui/button";

import type { RouterOutputs } from "@/trpc/shared";

type DeleteFolderButtonProps = {
  folder: RouterOutputs["folder"]["get"];
};

export function DeleteFolderButton({ folder }: DeleteFolderButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useTransitionRouter();

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Navigate back to folders page after deletion
      router.push("/dashboard/folders");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
      <DeleteFolderDialog
        folder={folder}
        open={open}
        onOpenChange={handleOpenChange}
      />
    </>
  );
}

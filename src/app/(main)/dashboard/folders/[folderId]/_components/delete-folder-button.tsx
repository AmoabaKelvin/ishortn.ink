"use client";

import { IconTrash } from "@tabler/icons-react";
import { useTransitionRouter } from "next-view-transitions";
import { useState } from "react";

import { DeleteFolderDialog } from "@/app/(main)/dashboard/folders/_components/delete-folder-dialog";

import type { RouterOutputs } from "@/trpc/shared";

type DeleteFolderButtonProps = {
  folder: RouterOutputs["folder"]["get"];
};

export function DeleteFolderButton({ folder }: DeleteFolderButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useTransitionRouter();

  const handleSuccess = () => {
    router.push("/dashboard/folders");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
      >
        <IconTrash size={14} stroke={1.5} />
        Delete
      </button>
      <DeleteFolderDialog
        folder={folder}
        open={open}
        onOpenChange={setOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}

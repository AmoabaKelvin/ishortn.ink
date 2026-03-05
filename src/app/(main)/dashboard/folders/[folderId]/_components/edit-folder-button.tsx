"use client";

import { IconPencil } from "@tabler/icons-react";
import { useState } from "react";

import { EditFolderModal } from "@/app/(main)/dashboard/folders/_components/edit-folder-modal";

import type { RouterOutputs } from "@/trpc/shared";

type EditFolderButtonProps = {
  folder: RouterOutputs["folder"]["get"];
};

export function EditFolderButton({ folder }: EditFolderButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
      >
        <IconPencil size={14} stroke={1.5} />
        Edit
      </button>
      <EditFolderModal folder={folder} open={open} onOpenChange={setOpen} />
    </>
  );
}

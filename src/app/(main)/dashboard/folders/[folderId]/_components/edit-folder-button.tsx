"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { EditFolderModal } from "@/app/(main)/dashboard/folders/_components/edit-folder-modal";
import { Button } from "@/components/ui/button";

import type { RouterOutputs } from "@/trpc/shared";

type EditFolderButtonProps = {
  folder: RouterOutputs["folder"]["get"];
};

export function EditFolderButton({ folder }: EditFolderButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </Button>
      <EditFolderModal folder={folder} open={open} onOpenChange={setOpen} />
    </>
  );
}

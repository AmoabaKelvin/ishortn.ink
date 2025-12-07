"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { CreateFolderModal } from "./create-folder-modal";
import { DeleteFolderDialog } from "./delete-folder-dialog";
import { EditFolderModal } from "./edit-folder-modal";
import { EmptyStateFree } from "./empty-state-free";
import { EmptyStatePro } from "./empty-state-pro";
import { FolderCard } from "./folder-card";

import type { RouterOutputs } from "@/trpc/shared";

type FoldersViewProps = {
  initialFolders: RouterOutputs["folder"]["list"];
  isProUser: boolean;
};

export function FoldersView({ initialFolders, isProUser }: FoldersViewProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<
    RouterOutputs["folder"]["list"][number] | null
  >(null);
  const [deletingFolder, setDeletingFolder] = useState<
    RouterOutputs["folder"]["list"][number] | null
  >(null);

  // We use initialFolders for rendering, but actions will invalidate queries
  // causing page revalidation or client-side updates if we used useQuery
  const folders = initialFolders;
  const hasFolders = folders && folders.length > 0;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Folders
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Organize your links into folders
          </p>
        </div>

        {isProUser && hasFolders && (
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            Create Folder
          </Button>
        )}
      </div>

      {/* Content */}
      {!isProUser ? (
        <EmptyStateFree />
      ) : !hasFolders ? (
        <EmptyStatePro onCreateClick={() => setCreateModalOpen(true)} />
      ) : (
        <div className="space-y-4">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onEdit={setEditingFolder}
              onDelete={setDeletingFolder}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateFolderModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      <EditFolderModal
        folder={editingFolder}
        open={!!editingFolder}
        onOpenChange={(open) => !open && setEditingFolder(null)}
      />

      <DeleteFolderDialog
        folder={deletingFolder}
        open={!!deletingFolder}
        onOpenChange={(open) => !open && setDeletingFolder(null)}
      />
    </div>
  );
}

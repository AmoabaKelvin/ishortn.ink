"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

import { CreateFolderModal } from "./create-folder-modal";
import { DeleteFolderDialog } from "./delete-folder-dialog";
import { EditFolderModal } from "./edit-folder-modal";
import { EmptyStateFree } from "./empty-state-free";
import { EmptyStatePro } from "./empty-state-pro";
import { FolderCard } from "./folder-card";
import { FolderSettingsModal } from "./folder-settings-modal";

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
  const [settingsFolder, setSettingsFolder] = useState<
    RouterOutputs["folder"]["list"][number] | null
  >(null);

  // Get current workspace to determine if we should show settings button
  const currentWorkspace = api.team.currentWorkspace.useQuery();
  const isTeamWorkspace = currentWorkspace.data?.type === "team";
  const isAdminOrOwner =
    isTeamWorkspace &&
    (currentWorkspace.data?.role === "owner" ||
      currentWorkspace.data?.role === "admin");

  // We use initialFolders for rendering, but actions will invalidate queries
  // causing page revalidation or client-side updates if we used useQuery
  const folders = initialFolders;
  const hasFolders = folders && folders.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Folders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organize your links into folders.
          </p>
        </div>

        {isProUser && hasFolders && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <FolderPlus className="mr-2 h-4 w-4" />
            Create Folder
          </Button>
        )}
      </div>

      {!isProUser ? (
        <div className="mt-8">
          <EmptyStateFree />
        </div>
      ) : !hasFolders ? (
        <div className="mt-8">
          <EmptyStatePro onCreateClick={() => setCreateModalOpen(true)} />
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onEdit={setEditingFolder}
              onDelete={setDeletingFolder}
              onSettings={setSettingsFolder}
              showSettingsButton={isAdminOrOwner}
            />
          ))}
        </div>
      )}

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

      <FolderSettingsModal
        folder={settingsFolder}
        open={!!settingsFolder}
        onOpenChange={(open) => !open && setSettingsFolder(null)}
      />
    </div>
  );
}

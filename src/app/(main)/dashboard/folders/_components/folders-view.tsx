"use client";

import { AnimatePresence } from "framer-motion";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";

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

  const folders = initialFolders;
  const hasFolders = folders && folders.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Folders
          </h2>
          {hasFolders && (
            <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
              {folders.length} {folders.length === 1 ? "folder" : "folders"} total
            </p>
          )}
        </div>

        {isProUser && hasFolders && (
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
          >
            <IconPlus size={16} stroke={2} />
            New Folder
          </button>
        )}
      </div>

      {/* Content */}
      {!isProUser ? (
        <EmptyStateFree />
      ) : !hasFolders ? (
        <EmptyStatePro onCreateClick={() => setCreateModalOpen(true)} />
      ) : (
        <div className="divide-y divide-neutral-300/60">
          <AnimatePresence>
            {folders.map((folder, index) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                index={index}
                onEdit={setEditingFolder}
                onDelete={setDeletingFolder}
                onSettings={setSettingsFolder}
                showSettingsButton={isAdminOrOwner}
              />
            ))}
          </AnimatePresence>
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

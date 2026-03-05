"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  IconCheck,
  IconChevronLeft,
  IconFolder,
  IconFolderPlus,
  IconLoader2,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

type MoveToFolderModalProps = {
  linkId?: number;
  linkIds?: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolderId?: number | null;
};

export function MoveToFolderModal({
  linkId,
  linkIds,
  open,
  onOpenChange,
  currentFolderId,
}: MoveToFolderModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    currentFolderId?.toString() ?? "none"
  );
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDescription, setNewFolderDescription] = useState("");

  const { data: folders, isLoading } = api.folder.list.useQuery(undefined, {
    enabled: open,
  });

  const utils = api.useUtils();

  const createFolderMutation = api.folder.create.useMutation({
    onSuccess: async (newFolder) => {
      await utils.folder.list.invalidate();
      const folderId = Number(newFolder.id);

      if (Number.isNaN(folderId)) {
        toast.error("Failed to get folder ID");
        return;
      }

      if (linkIds && linkIds.length > 0) {
        moveBulkLinksMutation.mutate({ linkIds, folderId });
      } else if (linkId) {
        moveLinkMutation.mutate({ linkId, folderId });
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const moveLinkMutation = api.folder.moveLink.useMutation({
    onSuccess: async () => {
      toast.success("Link moved");
      trackEvent(POSTHOG_EVENTS.LINK_MOVED_TO_FOLDER);
      await utils.link.list.invalidate();
      await utils.folder.list.invalidate();
      setIsCreatingNew(false);
      setNewFolderName("");
      setNewFolderDescription("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const moveBulkLinksMutation = api.folder.moveBulkLinks.useMutation({
    onSuccess: async (data) => {
      toast.success(`${data.count} ${data.count === 1 ? "link" : "links"} moved`);
      trackEvent(POSTHOG_EVENTS.LINK_MOVED_TO_FOLDER, {
        bulk: true,
        count: data.count,
      });
      await utils.link.list.invalidate();
      await utils.folder.list.invalidate();
      setIsCreatingNew(false);
      setNewFolderName("");
      setNewFolderDescription("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleMove = () => {
    if (isCreatingNew) {
      if (!newFolderName.trim()) {
        toast.error("Folder name is required");
        return;
      }
      createFolderMutation.mutate({
        name: newFolderName,
        description: newFolderDescription,
      });
    } else {
      const folderId =
        selectedFolderId === "none" ? null : Number.parseInt(selectedFolderId);

      if (linkIds && linkIds.length > 0) {
        moveBulkLinksMutation.mutate({ linkIds, folderId });
      } else if (linkId) {
        moveLinkMutation.mutate({ linkId, folderId });
      }
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(() => {
        setIsCreatingNew(false);
        setNewFolderName("");
        setNewFolderDescription("");
        setSearchQuery("");
      }, 300);
    }
    onOpenChange(newOpen);
  };

  const filteredFolders = folders?.filter((folder) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isMoving =
    moveLinkMutation.isLoading ||
    moveBulkLinksMutation.isLoading ||
    createFolderMutation.isLoading;
  const isBulkMove = linkIds && linkIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <AnimatePresence mode="wait" initial={false}>
          {isCreatingNew ? (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.15 }}
            >
              <DialogHeader className="flex-row items-center gap-3 space-y-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setNewFolderName("");
                    setNewFolderDescription("");
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                >
                  <IconChevronLeft size={18} stroke={1.5} />
                </button>
                <div>
                  <DialogTitle>Create Folder</DialogTitle>
                  <DialogDescription>Add a new folder and move link</DialogDescription>
                </div>
              </DialogHeader>

              <DialogBody className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="new-folder-name"
                    className="text-[13px] font-medium text-neutral-700"
                  >
                    Name
                  </Label>
                  <Input
                    id="new-folder-name"
                    placeholder="Folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="h-9 border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label
                    htmlFor="new-folder-description"
                    className="text-[13px] font-medium text-neutral-700"
                  >
                    Description
                    <span className="ml-1.5 text-[12px] font-normal text-neutral-400">
                      optional
                    </span>
                  </Label>
                  <Textarea
                    id="new-folder-description"
                    placeholder="Add notes about this folder..."
                    rows={3}
                    className="resize-none border-neutral-200 bg-white text-[13px] placeholder:text-neutral-400"
                    value={newFolderDescription}
                    onChange={(e) => setNewFolderDescription(e.target.value)}
                  />
                </div>
              </DialogBody>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setNewFolderName("");
                    setNewFolderDescription("");
                  }}
                  className="h-9 text-[13px]"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleMove}
                  disabled={isMoving || !newFolderName.trim()}
                  className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
                >
                  {isMoving ? (
                    <>
                      <IconLoader2
                        size={14}
                        stroke={1.5}
                        className="mr-1.5 animate-spin"
                      />
                      Creating...
                    </>
                  ) : (
                    "Create & Move"
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
            >
              <DialogHeader>
                <DialogTitle>
                  {isBulkMove ? `Move ${linkIds.length} links` : "Move to Folder"}
                </DialogTitle>
                <DialogDescription>Select a destination folder</DialogDescription>
              </DialogHeader>

              <DialogBody>
                {/* Search */}
                <div className="relative mb-3">
                  <IconSearch
                    size={16}
                    stroke={1.5}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                  <Input
                    placeholder="Search folders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 border-neutral-200 bg-white pl-9 pr-9 text-[13px] placeholder:text-neutral-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      <IconX size={14} stroke={1.5} />
                    </button>
                  )}
                </div>

                {/* Folders List */}
                <ScrollArea className="-mx-1 h-[260px] px-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <IconLoader2
                        size={16}
                        stroke={1.5}
                        className="animate-spin text-neutral-400"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* No Folder Option */}
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                          selectedFolderId === "none"
                            ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900/10"
                            : "border-transparent hover:bg-neutral-50"
                        )}
                        onClick={() => setSelectedFolderId("none")}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                            selectedFolderId === "none"
                              ? "bg-neutral-200"
                              : "bg-neutral-100"
                          )}
                        >
                          <IconX size={14} stroke={1.5} className="text-neutral-500" />
                        </div>
                        <span className="flex-1 text-[13px] font-medium text-neutral-900">
                          No folder
                        </span>
                        <div
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] transition-colors",
                            selectedFolderId === "none"
                              ? "border-blue-600 bg-blue-600"
                              : "border-neutral-300"
                          )}
                        >
                          {selectedFolderId === "none" && (
                            <IconCheck size={9} stroke={3} className="text-white" />
                          )}
                        </div>
                      </button>

                      {/* Folder Options */}
                      {filteredFolders && filteredFolders.length > 0 ? (
                        filteredFolders.map((folder) => (
                          <button
                            key={folder.id}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                              selectedFolderId === folder.id.toString()
                                ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900/10"
                                : "border-transparent hover:bg-neutral-50"
                            )}
                            onClick={() => setSelectedFolderId(folder.id.toString())}
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                                selectedFolderId === folder.id.toString()
                                  ? "bg-neutral-200"
                                  : "bg-neutral-100"
                              )}
                            >
                              <IconFolder size={14} stroke={1.5} className="text-neutral-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-neutral-900">
                                {folder.name}
                              </span>
                              <span className="text-[12px] text-neutral-400">
                                {folder.linkCount}{" "}
                                {folder.linkCount === 1 ? "link" : "links"}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] transition-colors",
                                selectedFolderId === folder.id.toString()
                                  ? "border-blue-600 bg-blue-600"
                                  : "border-neutral-300"
                              )}
                            >
                              {selectedFolderId === folder.id.toString() && (
                                <IconCheck size={9} stroke={3} className="text-white" />
                              )}
                            </div>
                          </button>
                        ))
                      ) : searchQuery ? (
                        <div className="py-8 text-center">
                          <p className="text-[13px] text-neutral-400">
                            No folders found
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </ScrollArea>

                {/* Create New Folder Button */}
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-200 p-2.5 text-[13px] font-medium text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <IconFolderPlus size={16} stroke={1.5} />
                  Create new folder
                </button>
              </DialogBody>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  className="h-9 text-[13px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleMove}
                  disabled={isMoving}
                  className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
                >
                  {isMoving ? (
                    <>
                      <IconLoader2
                        size={14}
                        stroke={1.5}
                        className="mr-1.5 animate-spin"
                      />
                      Moving...
                    </>
                  ) : (
                    "Move"
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

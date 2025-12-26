"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, Folder, FolderPlus, Loader2, Search, X } from "lucide-react";
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
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <DialogTitle>Create Folder</DialogTitle>
                  <DialogDescription>Add a new folder and move link</DialogDescription>
                </div>
              </DialogHeader>

              <DialogBody className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="new-folder-name"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Name
                  </Label>
                  <Input
                    id="new-folder-name"
                    placeholder="Folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="new-folder-description"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Description
                    <span className="ml-1.5 text-muted-foreground/60 lowercase tracking-normal font-normal">
                      optional
                    </span>
                  </Label>
                  <Textarea
                    id="new-folder-description"
                    placeholder="Add notes about this folder..."
                    rows={3}
                    className="resize-none text-sm"
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
                  className="h-9"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleMove}
                  disabled={isMoving || !newFolderName.trim()}
                  className="h-9"
                >
                  {isMoving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search folders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 pl-10 pr-10"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Folders List */}
                <ScrollArea className="h-[260px] -mx-1 px-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {/* No Folder Option */}
                      <button
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-all",
                          "border",
                          selectedFolderId === "none"
                            ? "border-foreground bg-foreground/[0.03] ring-1 ring-foreground/10"
                            : "border-transparent hover:bg-muted/50"
                        )}
                        onClick={() => setSelectedFolderId("none")}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                            selectedFolderId === "none"
                              ? "bg-foreground/10"
                              : "bg-muted"
                          )}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium flex-1 text-sm">
                          No folder
                        </span>
                        <div
                          className={cn(
                            "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
                            selectedFolderId === "none"
                              ? "border-foreground bg-foreground"
                              : "border-muted-foreground/30"
                          )}
                        >
                          {selectedFolderId === "none" && (
                            <Check className="h-2.5 w-2.5 text-background" />
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
                              "w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-all",
                              "border",
                              selectedFolderId === folder.id.toString()
                                ? "border-foreground bg-foreground/[0.03] ring-1 ring-foreground/10"
                                : "border-transparent hover:bg-muted/50"
                            )}
                            onClick={() => setSelectedFolderId(folder.id.toString())}
                          >
                            <div
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                                selectedFolderId === folder.id.toString()
                                  ? "bg-foreground/10"
                                  : "bg-muted"
                              )}
                            >
                              <Folder className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium block truncate text-sm">
                                {folder.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {folder.linkCount}{" "}
                                {folder.linkCount === 1 ? "link" : "links"}
                              </span>
                            </div>
                            <div
                              className={cn(
                                "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
                                selectedFolderId === folder.id.toString()
                                  ? "border-foreground bg-foreground"
                                  : "border-muted-foreground/30"
                              )}
                            >
                              {selectedFolderId === folder.id.toString() && (
                                <Check className="h-2.5 w-2.5 text-background" />
                              )}
                            </div>
                          </button>
                        ))
                      ) : searchQuery ? (
                        <div className="py-8 text-center">
                          <p className="text-sm text-muted-foreground">
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
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-2.5 mt-3 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground hover:bg-muted/50"
                >
                  <FolderPlus className="h-4 w-4" />
                  Create new folder
                </button>
              </DialogBody>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  className="h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleMove}
                  disabled={isMoving}
                  className="h-9"
                >
                  {isMoving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

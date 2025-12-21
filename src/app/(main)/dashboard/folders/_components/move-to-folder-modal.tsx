"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, Folder, FolderPlus, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
      <DialogContent className="max-w-md rounded-2xl border-0 p-0 overflow-hidden shadow-2xl gap-0">
        <AnimatePresence mode="wait">
          {isCreatingNew ? (
            <motion.div
              key="create"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Header with back button */}
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-3 mb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setNewFolderName("");
                      setNewFolderDescription("");
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <DialogHeader className="space-y-0">
                    <DialogTitle className="text-lg font-semibold text-gray-900">
                      Create folder
                    </DialogTitle>
                  </DialogHeader>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 pb-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-folder-name" className="text-sm font-medium text-gray-700">
                    Name
                  </Label>
                  <Input
                    id="new-folder-name"
                    placeholder="e.g., Marketing Campaign"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="rounded-xl border-gray-200 focus-visible:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-folder-description" className="text-sm font-medium text-gray-700">
                    Description <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="new-folder-description"
                    placeholder="Add notes about this folder..."
                    rows={3}
                    className="resize-none rounded-xl border-gray-200 focus-visible:ring-blue-500"
                    value={newFolderDescription}
                    onChange={(e) => setNewFolderDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setNewFolderName("");
                    setNewFolderDescription("");
                  }}
                  className="flex-1 rounded-xl border-gray-200 font-medium hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleMove}
                  disabled={isMoving || !newFolderName.trim()}
                  className="flex-1 rounded-xl bg-blue-500 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {isMoving ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Creating...
                    </span>
                  ) : (
                    "Create & Move"
                  )}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4">
                <DialogHeader className="space-y-1">
                  <DialogTitle className="text-lg font-semibold text-gray-900">
                    {isBulkMove ? `Move ${linkIds.length} links` : "Move to folder"}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    Select destination folder
                  </DialogDescription>
                </DialogHeader>
              </div>

              {/* Content */}
              <div className="px-6 pb-6">
                {/* Search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search folders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 rounded-xl border-gray-200 focus-visible:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Folders List */}
                <ScrollArea className="h-[280px] -mx-1 px-1">
                  {isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-14 rounded-xl bg-gray-100 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {/* No Folder Option */}
                      <motion.button
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all duration-150",
                          "border",
                          selectedFolderId === "none"
                            ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200"
                            : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                        )}
                        onClick={() => setSelectedFolderId("none")}
                      >
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                          selectedFolderId === "none" ? "bg-blue-100" : "bg-gray-100"
                        )}>
                          <X className={cn(
                            "h-4 w-4 transition-colors",
                            selectedFolderId === "none" ? "text-blue-600" : "text-gray-400"
                          )} />
                        </div>
                        <span className={cn(
                          "font-medium flex-1 transition-colors",
                          selectedFolderId === "none" ? "text-blue-900" : "text-gray-900"
                        )}>
                          No folder
                        </span>
                        <div className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                          selectedFolderId === "none"
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300 bg-white"
                        )}>
                          {selectedFolderId === "none" && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ duration: 0.15 }}
                            >
                              <Check className="h-3 w-3 text-white" strokeWidth={3} />
                            </motion.div>
                          )}
                        </div>
                      </motion.button>

                      {/* Folder Options */}
                      {filteredFolders && filteredFolders.length > 0 ? (
                        filteredFolders.map((folder, index) => (
                          <motion.button
                            key={folder.id}
                            type="button"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15, delay: (index + 1) * 0.03 }}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all duration-150",
                              "border",
                              selectedFolderId === folder.id.toString()
                                ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200"
                                : "bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                            )}
                            onClick={() => setSelectedFolderId(folder.id.toString())}
                          >
                            <div className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                              selectedFolderId === folder.id.toString() ? "bg-blue-100" : "bg-gray-100"
                            )}>
                              <Folder className={cn(
                                "h-4 w-4 transition-colors",
                                selectedFolderId === folder.id.toString() ? "text-blue-600" : "text-gray-500"
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={cn(
                                "font-medium block truncate transition-colors",
                                selectedFolderId === folder.id.toString() ? "text-blue-900" : "text-gray-900"
                              )}>
                                {folder.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {folder.linkCount} {folder.linkCount === 1 ? "link" : "links"}
                              </span>
                            </div>
                            <div className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                              selectedFolderId === folder.id.toString()
                                ? "border-blue-500 bg-blue-500"
                                : "border-gray-300 bg-white"
                            )}>
                              {selectedFolderId === folder.id.toString() && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ duration: 0.15 }}
                                >
                                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                                </motion.div>
                              )}
                            </div>
                          </motion.button>
                        ))
                      ) : searchQuery ? (
                        <div className="py-8 text-center">
                          <p className="text-sm text-gray-500">No folders found</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </ScrollArea>

                {/* Create New Folder Button */}
                <motion.button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-3 mt-3 text-sm font-medium text-gray-500 transition-colors hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <FolderPlus className="h-4 w-4" />
                  Create new folder
                </motion.button>
              </div>

              {/* Footer */}
              <div className="flex gap-2 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  className="flex-1 rounded-xl border-gray-200 font-medium hover:bg-gray-100"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleMove}
                  disabled={isMoving}
                  className="flex-1 rounded-xl bg-blue-500 font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                >
                  {isMoving ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Moving...
                    </span>
                  ) : (
                    "Move"
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

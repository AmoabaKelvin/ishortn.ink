"use client";

import { FolderInput, FolderPlus, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
      console.log("Created folder:", newFolder);
      await utils.folder.list.invalidate();
      // Automatically move the link to the newly created folder
      const folderId = Number(newFolder.id);

      console.log("Moving to folder ID:", folderId);

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
      toast.success("Link moved successfully");
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
      toast.success(
        `${data.count} ${
          data.count === 1 ? "link" : "links"
        } moved successfully`
      );
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
      // Create new folder and move link
      if (!newFolderName.trim()) {
        toast.error("Folder name is required");
        return;
      }
      createFolderMutation.mutate({
        name: newFolderName,
        description: newFolderDescription,
      });
    } else {
      // Move to existing folder
      const folderId =
        selectedFolderId === "none" ? null : Number.parseInt(selectedFolderId);

      if (linkIds && linkIds.length > 0) {
        moveBulkLinksMutation.mutate({ linkIds, folderId });
      } else if (linkId) {
        moveLinkMutation.mutate({ linkId, folderId });
      }
    }
  };

  // Reset creating state when modal opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Delay resetting state slightly to allow closing animation
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="h-5 w-5 text-blue-600" />
            {isCreatingNew
              ? "Create New Folder"
              : isBulkMove
              ? `Move ${linkIds.length} Links`
              : "Move Link to Folder"}
          </DialogTitle>
          <DialogDescription>
            {isCreatingNew
              ? "Create a new folder and move your selected link(s) into it."
              : isBulkMove
              ? "Select a folder to move the selected links to."
              : "Select a folder or choose to remove from current folder."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isCreatingNew ? (
            /* Create New Folder Form */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-folder-name">
                  Folder Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="new-folder-name"
                  placeholder="e.g., Marketing Campaign 2024"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-folder-description">
                  Description (Optional)
                </Label>
                <Textarea
                  id="new-folder-description"
                  placeholder="Add notes about what this folder contains..."
                  rows={3}
                  className="resize-none"
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewFolderName("");
                  setNewFolderDescription("");
                }}
                className="w-full"
              >
                Back to Folders
              </Button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Folders List */}
              <ScrollArea className="h-[300px] rounded-md border p-4">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-12 rounded-md bg-gray-100 animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <RadioGroup
                    value={selectedFolderId}
                    onValueChange={setSelectedFolderId}
                  >
                    <div className="space-y-2">
                      {/* No Folder Option */}
                      <div
                        className={cn(
                          "flex items-center space-x-3 rounded-md p-3 transition-colors cursor-pointer hover:bg-gray-50",
                          selectedFolderId === "none" &&
                            "bg-blue-50 hover:bg-blue-50"
                        )}
                        onClick={() => setSelectedFolderId("none")}
                      >
                        <RadioGroupItem value="none" id="folder-none" />
                        <Label
                          htmlFor="folder-none"
                          className="flex-1 cursor-pointer font-medium"
                        >
                          No Folder
                        </Label>
                      </div>

                      {/* Folder Options */}
                      {filteredFolders && filteredFolders.length > 0 ? (
                        filteredFolders.map((folder) => (
                          <div
                            key={folder.id}
                            className={cn(
                              "flex items-center space-x-3 rounded-md p-3 transition-colors cursor-pointer hover:bg-gray-50",
                              selectedFolderId === folder.id.toString() &&
                                "bg-blue-50 hover:bg-blue-50"
                            )}
                            onClick={() =>
                              setSelectedFolderId(folder.id.toString())
                            }
                          >
                            <RadioGroupItem
                              value={folder.id.toString()}
                              id={`folder-${folder.id}`}
                            />
                            <Label
                              htmlFor={`folder-${folder.id}`}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="font-medium">{folder.name}</div>
                              <div className="text-xs text-gray-500">
                                {folder.linkCount}{" "}
                                {folder.linkCount === 1 ? "link" : "links"}
                              </div>
                            </Label>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-sm text-gray-500 mb-3">
                            {searchQuery
                              ? "No folders found"
                              : "No folders available"}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsCreatingNew(true)}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <FolderPlus className="mr-2 h-4 w-4" />
                            Create New Folder
                          </Button>
                        </div>
                      )}
                    </div>
                  </RadioGroup>
                )}
              </ScrollArea>

              {/* Create New Folder Button - Show when folders exist */}
              {filteredFolders && filteredFolders.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Create New Folder
                </Button>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleMove}
            disabled={isMoving || (isCreatingNew && !newFolderName.trim())}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isMoving
              ? isCreatingNew
                ? "Creating..."
                : "Moving..."
              : isCreatingNew
              ? "Create & Move"
              : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

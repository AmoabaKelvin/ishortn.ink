"use client";

import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type FolderSettingsModalProps = {
  folder: RouterOutputs["folder"]["list"][number] | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FolderSettingsModal({
  folder,
  open,
  onOpenChange,
}: FolderSettingsModalProps) {
  const [accessType, setAccessType] = useState<"all" | "specific">("all");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const utils = api.useUtils();

  const teamMembers = api.team.listMembers.useQuery(undefined, {
    enabled: open,
  });

  const folderPermissions = api.folder.getPermissions.useQuery(
    { folderId: folder?.id ?? 0 },
    { enabled: open && !!folder }
  );

  const updatePermissions = api.folder.updatePermissions.useMutation({
    onSuccess: async () => {
      toast.success("Folder access updated successfully");
      await utils.folder.list.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const regularMembers =
    teamMembers.data?.filter((m) => m.role === "member") ?? [];

  useEffect(() => {
    if (folderPermissions.data) {
      if (folderPermissions.data.isRestricted) {
        setAccessType("specific");
        setSelectedUserIds(
          folderPermissions.data.permittedUsers.map((u) => u.id)
        );
      } else {
        setAccessType("all");
        setSelectedUserIds([]);
      }
    }
  }, [folderPermissions.data]);

  useEffect(() => {
    if (!open) {
      setAccessType("all");
      setSelectedUserIds([]);
      setPopoverOpen(false);
    }
  }, [open]);

  const handleSave = () => {
    if (!folder) return;

    updatePermissions.mutate({
      folderId: folder.id,
      isRestricted: accessType === "specific",
      userIds: accessType === "all" ? [] : selectedUserIds,
    });
  };

  const toggleMember = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const removeMember = (userId: string) => {
    setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
  };

  const getSelectedMembers = () => {
    return regularMembers.filter((m) => selectedUserIds.includes(m.userId));
  };

  if (!folder) return null;

  const isLoading = teamMembers.isLoading || folderPermissions.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Folder Access</DialogTitle>
          <DialogDescription>
            Manage who can view &quot;{folder.name}&quot;
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center px-6 py-12">
            <IconLoader2
              size={16}
              stroke={1.5}
              className="animate-spin text-neutral-400"
            />
          </div>
        ) : (
          <DialogBody className="space-y-5">
            {/* Access type selection */}
            <div className="space-y-1.5">
              <Label className="text-[13px] font-medium text-neutral-700">
                Access Level
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccessType("all")}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                    accessType === "all"
                      ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900/10"
                      : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                  )}
                >
                  <span className="text-[13px] font-medium text-neutral-900">All members</span>
                  <span className="text-[12px] text-neutral-400">
                    Full team access
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAccessType("specific")}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                    accessType === "specific"
                      ? "border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900/10"
                      : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
                  )}
                >
                  <span className="text-[13px] font-medium text-neutral-900">Restricted</span>
                  <span className="text-[12px] text-neutral-400">
                    Selected members
                  </span>
                </button>
              </div>
            </div>

            {/* Member selection */}
            {accessType === "specific" && (
              <div className="space-y-3">
                <Label className="text-[13px] font-medium text-neutral-700">
                  Team Members
                </Label>

                {regularMembers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-200 py-6 text-center text-[13px] text-neutral-400">
                    No regular members in this team
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between h-9 border-neutral-200 bg-white text-[13px] font-normal"
                        >
                          <span className="text-neutral-400">
                            {selectedUserIds.length > 0
                              ? `${selectedUserIds.length} selected`
                              : "Select members"}
                          </span>
                          <span className="text-[12px] text-neutral-400">
                            {regularMembers.length} available
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search..." className="h-9" />
                          <CommandList>
                            <CommandEmpty className="py-4 text-center text-[13px] text-neutral-400">
                              No members found
                            </CommandEmpty>
                            <CommandGroup>
                              {regularMembers.map((member) => (
                                <CommandItem
                                  key={member.userId}
                                  value={member.user.name ?? member.user.email ?? member.userId}
                                  onSelect={() => toggleMember(member.userId)}
                                  className="flex items-center gap-3 px-3 py-2.5"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage
                                      src={member.user.imageUrl ?? undefined}
                                    />
                                    <AvatarFallback className="text-[10px] bg-neutral-100 text-neutral-600">
                                      {member.user.name?.[0]?.toUpperCase() ??
                                        member.user.email?.[0]?.toUpperCase() ??
                                        "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-neutral-900 truncate">
                                      {member.user.name ?? "Unknown"}
                                    </p>
                                    <p className="text-[12px] text-neutral-400 truncate">
                                      {member.user.email}
                                    </p>
                                  </div>
                                  <div
                                    className={cn(
                                      "flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] transition-colors",
                                      selectedUserIds.includes(member.userId)
                                        ? "border-blue-600 bg-blue-600"
                                        : "border-neutral-300"
                                    )}
                                  >
                                    {selectedUserIds.includes(member.userId) && (
                                      <IconCheck size={9} stroke={3} className="text-white" />
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Selected members */}
                    {selectedUserIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {getSelectedMembers().map((member) => (
                          <div
                            key={member.userId}
                            className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white py-0.5 pl-1 pr-1.5 text-[12px]"
                          >
                            <Avatar className="h-4 w-4">
                              <AvatarImage
                                src={member.user.imageUrl ?? undefined}
                              />
                              <AvatarFallback className="text-[8px] bg-neutral-100 text-neutral-600">
                                {member.user.name?.[0]?.toUpperCase() ?? "U"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-neutral-600 max-w-[100px] truncate">
                              {member.user.name?.split(" ")[0] ?? member.user.email?.split("@")[0]}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeMember(member.userId)}
                              className="rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                            >
                              <IconX size={10} stroke={2} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedUserIds.length === 0 && (
                      <p className="text-[12px] text-neutral-400">
                        Only owners and admins will have access
                      </p>
                    )}
                  </div>
                )}

                <p className="text-[12px] text-neutral-400 pt-1">
                  Owners and admins always have access to all folders
                </p>
              </div>
            )}
          </DialogBody>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-9 text-[13px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updatePermissions.isLoading || isLoading}
            className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
          >
            {updatePermissions.isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

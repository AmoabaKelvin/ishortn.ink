"use client";

import { IconCheck, IconLoader2, IconX } from "@tabler/icons-react";
import { useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type Folder = RouterOutputs["folder"]["list"][number];
type FolderPermissions = RouterOutputs["folder"]["getPermissions"];
type TeamMember = RouterOutputs["team"]["listMembers"][number];

type FolderSettingsModalProps = {
  folder: Folder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FolderSettingsModal({ folder, open, onOpenChange }: FolderSettingsModalProps) {
  const utils = api.useUtils();

  const teamMembers = api.team.listMembers.useQuery(undefined, {
    enabled: open,
  });

  const folderPermissions = api.folder.getPermissions.useQuery(
    { folderId: folder?.id ?? 0 },
    { enabled: open && !!folder },
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

  if (!folder) return null;

  const isLoading = teamMembers.isLoading || folderPermissions.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Folder Access</DialogTitle>
          <DialogDescription>Manage who can view &quot;{folder.name}&quot;</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <>
            <div className="flex items-center justify-center px-6 py-12">
              <IconLoader2
                size={16}
                stroke={1.5}
                className="animate-spin text-neutral-400 dark:text-neutral-500"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-9 text-[13px]"
              >
                Cancel
              </Button>
              <Button disabled className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700">
                Save
              </Button>
            </DialogFooter>
          </>
        ) : (
          <FolderAccessForm
            permissions={folderPermissions.data}
            members={teamMembers.data?.filter((m) => m.role === "member") ?? []}
            saving={updatePermissions.isLoading}
            onCancel={() => onOpenChange(false)}
            onSave={(selection) => updatePermissions.mutate({ folderId: folder.id, ...selection })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function selectionFrom(permissions: FolderPermissions | undefined) {
  return permissions?.isRestricted
    ? { accessType: "specific" as const, userIds: permissions.permittedUsers.map((u) => u.id) }
    : { accessType: "all" as const, userIds: [] };
}

type FolderAccessFormProps = {
  permissions: FolderPermissions | undefined;
  members: TeamMember[];
  saving: boolean;
  onCancel: () => void;
  onSave: (selection: { isRestricted: boolean; userIds: string[] }) => void;
};

// Mounted only while the dialog is open and loaded, so the selection starts
// from the fetched permissions and is discarded when the dialog closes.
function FolderAccessForm({
  permissions,
  members,
  saving,
  onCancel,
  onSave,
}: FolderAccessFormProps) {
  const [accessType, setAccessType] = useState<"all" | "specific">(
    () => selectionFrom(permissions).accessType,
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    () => selectionFrom(permissions).userIds,
  );
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [syncedPermissions, setSyncedPermissions] = useState(permissions);

  // A refetch that changes the server state replaces the in-progress selection.
  if (syncedPermissions !== permissions) {
    setSyncedPermissions(permissions);
    if (permissions) {
      const next = selectionFrom(permissions);
      setAccessType(next.accessType);
      setSelectedUserIds(next.userIds);
    }
  }

  const handleSave = () => {
    onSave({
      isRestricted: accessType === "specific",
      userIds: accessType === "all" ? [] : selectedUserIds,
    });
  };

  const toggleMember = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const removeMember = (userId: string) => {
    setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
  };

  const selectedMembers = members.filter((m) => selectedUserIds.includes(m.userId));

  return (
    <>
      <DialogBody className="space-y-5">
        {/* Access type selection */}
        <div className="space-y-1.5">
          <Label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
            Access Level
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAccessType("all")}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                accessType === "all"
                  ? "border-neutral-900 bg-neutral-50 dark:bg-accent/50 ring-1 ring-neutral-900/10"
                  : "border-neutral-200 dark:border-border hover:border-neutral-300 dark:hover:border-border hover:bg-neutral-50 dark:hover:bg-accent/50",
              )}
            >
              <span className="text-[13px] font-medium text-neutral-900 dark:text-foreground">
                All members
              </span>
              <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                Full team access
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAccessType("specific")}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all",
                accessType === "specific"
                  ? "border-neutral-900 bg-neutral-50 dark:bg-accent/50 ring-1 ring-neutral-900/10"
                  : "border-neutral-200 dark:border-border hover:border-neutral-300 dark:hover:border-border hover:bg-neutral-50 dark:hover:bg-accent/50",
              )}
            >
              <span className="text-[13px] font-medium text-neutral-900 dark:text-foreground">
                Restricted
              </span>
              <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                Selected members
              </span>
            </button>
          </div>
        </div>

        {/* Member selection */}
        {accessType === "specific" && (
          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
              Team Members
            </Label>

            {members.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-200 dark:border-border py-6 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
                No regular members in this team
              </div>
            ) : (
              <div className="space-y-3">
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] font-normal"
                    >
                      <span className="text-neutral-400 dark:text-neutral-500">
                        {selectedUserIds.length > 0
                          ? `${selectedUserIds.length} selected`
                          : "Select members"}
                      </span>
                      <span className="text-[12px] text-neutral-400 dark:text-neutral-500">
                        {members.length} available
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search..." className="h-9" />
                      <CommandList>
                        <CommandEmpty className="py-4 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
                          No members found
                        </CommandEmpty>
                        <CommandGroup>
                          {members.map((member) => (
                            <CommandItem
                              key={member.userId}
                              value={member.user.name ?? member.user.email ?? member.userId}
                              onSelect={() => toggleMember(member.userId)}
                              className="flex items-center gap-3 px-3 py-2.5"
                            >
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={member.user.imageUrl ?? undefined} />
                                <AvatarFallback className="text-[10px] bg-neutral-100 dark:bg-muted text-neutral-600 dark:text-neutral-400">
                                  {member.user.name?.[0]?.toUpperCase() ??
                                    member.user.email?.[0]?.toUpperCase() ??
                                    "U"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground truncate">
                                  {member.user.name ?? "Unknown"}
                                </p>
                                <p className="text-[12px] text-neutral-400 dark:text-neutral-500 truncate">
                                  {member.user.email}
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] transition-colors",
                                  selectedUserIds.includes(member.userId)
                                    ? "border-blue-600 bg-blue-600"
                                    : "border-neutral-300 dark:border-border",
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
                    {selectedMembers.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-border bg-white dark:bg-card py-0.5 pl-1 pr-1.5 text-[12px]"
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={member.user.imageUrl ?? undefined} />
                          <AvatarFallback className="text-[8px] bg-neutral-100 dark:bg-muted text-neutral-600 dark:text-neutral-400">
                            {member.user.name?.[0]?.toUpperCase() ?? "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-neutral-600 dark:text-neutral-400 max-w-[100px] truncate">
                          {member.user.name?.split(" ")[0] ?? member.user.email?.split("@")[0]}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMember(member.userId)}
                          className="rounded p-0.5 text-neutral-400 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600"
                        >
                          <IconX size={10} stroke={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedUserIds.length === 0 && (
                  <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
                    Only owners and admins will have access
                  </p>
                )}
              </div>
            )}

            <p className="text-[12px] text-neutral-400 dark:text-neutral-500 pt-1">
              Owners and admins always have access to all folders
            </p>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} className="h-9 text-[13px]">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

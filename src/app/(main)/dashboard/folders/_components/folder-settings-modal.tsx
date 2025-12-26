"use client";

import { Check, Loader2, X } from "lucide-react";
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

type TeamMember = {
  id: number;
  userId: string;
  role: "owner" | "admin" | "member";
  user: {
    id: string;
    name: string | null;
    email: string | null;
    imageUrl: string | null;
  };
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

  // Fetch team members (only members, not admins/owners since they always have access)
  const teamMembers = api.team.listMembers.useQuery(undefined, {
    enabled: open,
  });

  // Fetch current folder permissions
  const folderPermissions = api.folder.getPermissions.useQuery(
    { folderId: folder?.id ?? 0 },
    { enabled: open && !!folder }
  );

  // Update permissions mutation
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

  // Filter to only show regular members (admins/owners always have access)
  const regularMembers =
    teamMembers.data?.filter((m) => m.role === "member") ?? [];

  // Initialize state when modal opens or permissions load
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

  // Reset state when modal closes
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
          <div className="flex items-center justify-center py-12 px-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DialogBody className="space-y-5">
            {/* Access type selection */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Access Level
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccessType("all")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-all",
                    accessType === "all"
                      ? "border-foreground bg-foreground/[0.03] ring-1 ring-foreground/10"
                      : "border-border hover:border-foreground/20 hover:bg-muted/50"
                  )}
                >
                  <span className="text-sm font-medium">All members</span>
                  <span className="text-xs text-muted-foreground">
                    Full team access
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAccessType("specific")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-all",
                    accessType === "specific"
                      ? "border-foreground bg-foreground/[0.03] ring-1 ring-foreground/10"
                      : "border-border hover:border-foreground/20 hover:bg-muted/50"
                  )}
                >
                  <span className="text-sm font-medium">Restricted</span>
                  <span className="text-xs text-muted-foreground">
                    Selected members
                  </span>
                </button>
              </div>
            </div>

            {/* Member selection (only shown when "specific" is selected) */}
            {accessType === "specific" && (
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Team Members
                </Label>

                {regularMembers.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                    No regular members in this team
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between h-10 font-normal"
                        >
                          <span className="text-muted-foreground">
                            {selectedUserIds.length > 0
                              ? `${selectedUserIds.length} selected`
                              : "Select members"}
                          </span>
                          <span className="text-xs text-muted-foreground/60">
                            {regularMembers.length} available
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search..." className="h-9" />
                          <CommandList>
                            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                              No members found
                            </CommandEmpty>
                            <CommandGroup>
                              {regularMembers.map((member) => (
                                <CommandItem
                                  key={member.userId}
                                  value={member.user.name ?? member.user.email ?? member.userId}
                                  onSelect={() => toggleMember(member.userId)}
                                  className="flex items-center gap-3 py-2.5 px-3"
                                >
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage
                                      src={member.user.imageUrl ?? undefined}
                                    />
                                    <AvatarFallback className="text-xs bg-muted">
                                      {member.user.name?.[0]?.toUpperCase() ??
                                        member.user.email?.[0]?.toUpperCase() ??
                                        "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {member.user.name ?? "Unknown"}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {member.user.email}
                                    </p>
                                  </div>
                                  <div
                                    className={cn(
                                      "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
                                      selectedUserIds.includes(member.userId)
                                        ? "border-foreground bg-foreground"
                                        : "border-muted-foreground/30"
                                    )}
                                  >
                                    {selectedUserIds.includes(member.userId) && (
                                      <Check className="h-2.5 w-2.5 text-background" />
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
                            className="flex items-center gap-1.5 rounded-full bg-muted pl-1 pr-1.5 py-0.5 text-xs"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarImage
                                src={member.user.imageUrl ?? undefined}
                              />
                              <AvatarFallback className="text-[9px] bg-muted-foreground/10">
                                {member.user.name?.[0]?.toUpperCase() ?? "U"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground/80 max-w-[100px] truncate">
                              {member.user.name?.split(" ")[0] ?? member.user.email?.split("@")[0]}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeMember(member.userId)}
                              className="rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                            >
                              <X className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedUserIds.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Only owners and admins will have access
                      </p>
                    )}
                  </div>
                )}

                {/* Info note */}
                <p className="text-xs text-muted-foreground pt-1">
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
            className="h-9"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updatePermissions.isLoading || isLoading}
            className="h-9"
          >
            {updatePermissions.isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

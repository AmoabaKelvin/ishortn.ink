"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  IconCheck,
  IconCopy,
  IconCrown,
  IconDots,
  IconLink,
  IconLoader2,
  IconMail,
  IconShield,
  IconTrash,
  IconUser,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAppBaseDomain } from "@/lib/constants/domains";
import { api } from "@/trpc/react";

const baseDomain = getAppBaseDomain();

const inviteSchema = z.object({
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  role: z.enum(["admin", "member"]).default("member"),
});

type InviteInput = z.infer<typeof inviteSchema>;

const roleConfig = {
  owner: { color: "bg-amber-500", label: "Owner" },
  admin: { color: "bg-violet-500", label: "Admin" },
  member: { color: "bg-neutral-400", label: "Member" },
};

export default function TeamMembersPage() {
  const router = useRouter();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(
    null
  );
  const [transferOwnershipMemberId, setTransferOwnershipMemberId] = useState<
    string | null
  >(null);

  const currentWorkspace = api.team.currentWorkspace.useQuery();
  const isTeamWorkspace = currentWorkspace.data?.type === "team";
  const currentRole =
    currentWorkspace.data?.type === "team"
      ? currentWorkspace.data.role
      : undefined;

  const isOwner = currentRole === "owner";
  const canManageMembers = currentRole === "owner" || currentRole === "admin";

  const members = api.team.listMembers.useQuery(undefined, {
    enabled: isTeamWorkspace,
  });
  const invites = api.team.listInvites.useQuery(undefined, {
    enabled: isTeamWorkspace && canManageMembers,
  });

  const createInviteMutation = api.team.createInvite.useMutation({
    onSuccess: (data) => {
      setGeneratedInviteUrl(data.inviteUrl);
      invites.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const revokeInviteMutation = api.team.revokeInvite.useMutation({
    onSuccess: () => {
      toast.success("Invite revoked");
      invites.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateRoleMutation = api.team.updateMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      members.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeMemberMutation = api.team.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed");
      members.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const transferOwnershipMutation = api.team.transferOwnership.useMutation({
    onSuccess: () => {
      toast.success("Ownership transferred");
      members.refetch();
      currentWorkspace.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const inviteForm = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "member",
    },
  });

  const onInvite = async (values: InviteInput) => {
    await createInviteMutation.mutateAsync({
      email: values.email || undefined,
      role: values.role,
    });
    inviteForm.reset();
  };

  const copyInviteUrl = () => {
    if (generatedInviteUrl) {
      navigator.clipboard.writeText(generatedInviteUrl);
      toast.success("Link copied");
    }
  };

  const closeInviteDialog = () => {
    setInviteDialogOpen(false);
    setGeneratedInviteUrl(null);
    inviteForm.reset();
  };

  if (currentWorkspace.isLoading || members.isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <IconLoader2
          size={20}
          stroke={1.5}
          className="animate-spin text-neutral-400 dark:text-neutral-500"
        />
      </div>
    );
  }

  if (!isTeamWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
          <IconUsers size={20} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
        </div>
        <p className="mt-4 text-[14px] font-medium text-neutral-900 dark:text-foreground">
          Team Members
        </p>
        <p className="mt-1 max-w-sm text-center text-[13px] text-neutral-400 dark:text-neutral-500">
          Switch to a team workspace to manage members and their roles.
        </p>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mt-4 rounded-lg border border-neutral-200 dark:border-border px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
            Members
          </h1>
          <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
            Manage your team members and their roles.
          </p>
        </div>
        {canManageMembers && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                <IconUserPlus size={15} stroke={1.5} />
                Invite
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-xl border-neutral-200 dark:border-border">
              <DialogHeader>
                <DialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
                  Invite member
                </DialogTitle>
                <DialogDescription className="text-[12px] text-neutral-400 dark:text-neutral-500">
                  Send an invite link to add someone to your team.
                </DialogDescription>
              </DialogHeader>

              {generatedInviteUrl ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-500/10 p-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
                      <IconCheck size={14} stroke={1.5} />
                      Invite created
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={generatedInviteUrl}
                      readOnly
                      className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={copyInviteUrl}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 dark:border-border text-neutral-500 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 hover:text-neutral-700"
                    >
                      <IconCopy size={14} stroke={1.5} />
                    </button>
                  </div>
                  <DialogFooter>
                    <button
                      type="button"
                      onClick={closeInviteDialog}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      Done
                    </button>
                  </DialogFooter>
                </div>
              ) : (
                <Form {...inviteForm}>
                  <form
                    onSubmit={inviteForm.handleSubmit(onInvite)}
                    className="space-y-4"
                  >
                    <FormField
                      control={inviteForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                            Email (optional)
                          </label>
                          <FormControl>
                            <Input
                              placeholder="colleague@company.com"
                              className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                            Leave empty to create a link-only invite.
                          </p>
                          <FormMessage className="text-[11px]" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={inviteForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                            Role
                          </label>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px]">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem
                                value="member"
                                className="text-[13px]"
                              >
                                <div className="flex items-center gap-2">
                                  <IconUser
                                    size={14}
                                    stroke={1.5}
                                    className="text-neutral-400 dark:text-neutral-500"
                                  />
                                  Member
                                </div>
                              </SelectItem>
                              {isOwner && (
                                <SelectItem
                                  value="admin"
                                  className="text-[13px]"
                                >
                                  <div className="flex items-center gap-2">
                                    <IconShield
                                      size={14}
                                      stroke={1.5}
                                      className="text-violet-500"
                                    />
                                    Admin
                                  </div>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-[11px]" />
                        </FormItem>
                      )}
                    />

                    <DialogFooter className="gap-2 pt-2">
                      <button
                        type="button"
                        onClick={closeInviteDialog}
                        className="rounded-lg border border-neutral-200 dark:border-border px-4 py-2 text-[13px] font-medium text-neutral-600 dark:text-neutral-400 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createInviteMutation.isLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        {createInviteMutation.isLoading && (
                          <IconLoader2
                            size={14}
                            stroke={1.5}
                            className="animate-spin"
                          />
                        )}
                        Create invite
                      </button>
                    </DialogFooter>
                  </form>
                </Form>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Members List */}
      <div className="divide-y divide-neutral-300/60">
        {members.data?.map((member, index) => {
          const config =
            roleConfig[member.role as keyof typeof roleConfig] ??
            roleConfig.member;

          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
              className="group px-1 py-4"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage
                    src={member.user?.imageUrl ?? undefined}
                    alt={member.user?.name ?? "User"}
                  />
                  <AvatarFallback className="bg-neutral-100 dark:bg-muted text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
                    {member.user?.name?.[0]?.toUpperCase() ??
                      member.user?.email?.[0]?.toUpperCase() ??
                      "U"}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-medium text-neutral-900 dark:text-foreground">
                      {member.user?.name || "Unknown"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${config.color}`}
                      />
                      {config.label}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">
                    {member.user?.email}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {canManageMembers && member.role !== "owner" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 opacity-0 transition-all hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600 group-hover:opacity-100"
                        >
                          <IconDots size={15} stroke={1.5} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {isOwner && member.role === "member" && (
                          <DropdownMenuItem
                            onClick={() =>
                              updateRoleMutation.mutate({
                                userId: member.userId,
                                role: "admin",
                              })
                            }
                            className="text-[13px]"
                          >
                            <IconShield
                              size={14}
                              stroke={1.5}
                              className="mr-2"
                            />
                            Make admin
                          </DropdownMenuItem>
                        )}
                        {isOwner && member.role === "admin" && (
                          <DropdownMenuItem
                            onClick={() =>
                              updateRoleMutation.mutate({
                                userId: member.userId,
                                role: "member",
                              })
                            }
                            className="text-[13px]"
                          >
                            <IconUser
                              size={14}
                              stroke={1.5}
                              className="mr-2"
                            />
                            Make member
                          </DropdownMenuItem>
                        )}
                        {isOwner && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                setTransferOwnershipMemberId(member.userId)
                              }
                              className="text-[13px] text-amber-600 dark:text-amber-400"
                            >
                              <IconCrown
                                size={14}
                                stroke={1.5}
                                className="mr-2"
                              />
                              Transfer ownership
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            removeMemberMutation.mutate({
                              userId: member.userId,
                            })
                          }
                          className="text-[13px] text-red-600 dark:text-red-400"
                        >
                          <IconUserMinus
                            size={14}
                            stroke={1.5}
                            className="mr-2"
                          />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pending Invites */}
      {canManageMembers && invites.data && invites.data.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-2 text-[14px] font-semibold text-neutral-900 dark:text-foreground">
            Pending invites
          </h2>
          <div className="divide-y divide-neutral-300/60">
            {invites.data.map((invite, index) => (
              <motion.div
                key={invite.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.04 }}
                className="group px-1 py-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-muted">
                    {invite.email ? (
                      <IconMail
                        size={14}
                        stroke={1.5}
                        className="text-neutral-400 dark:text-neutral-500"
                      />
                    ) : (
                      <IconLink
                        size={14}
                        stroke={1.5}
                        className="text-neutral-400 dark:text-neutral-500"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium text-neutral-900 dark:text-foreground">
                        {invite.email || "Open invite"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${invite.isExpired ? "bg-red-500" : "bg-emerald-500"}`}
                        />
                        {invite.isExpired ? "Expired" : "Active"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
                      <span className="text-neutral-400 dark:text-neutral-500">
                        {invite.isExpired
                          ? "Expired"
                          : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                      </span>
                      <span className="text-neutral-300">&middot;</span>
                      <span className="capitalize text-neutral-500 dark:text-neutral-400">
                        {invite.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 dark:text-neutral-500 opacity-0 transition-all hover:bg-neutral-100 dark:hover:bg-accent hover:text-neutral-600 group-hover:opacity-100"
                        >
                          <IconDots size={15} stroke={1.5} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `https://${baseDomain}/teams/accept-invite?token=${invite.token}`
                            );
                            toast.success("Link copied");
                          }}
                          className="text-[13px]"
                        >
                          <IconCopy
                            size={14}
                            stroke={1.5}
                            className="mr-2"
                          />
                          Copy link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            revokeInviteMutation.mutate({
                              inviteId: invite.id,
                            })
                          }
                          className="text-[13px] text-red-600 dark:text-red-400"
                        >
                          <IconTrash
                            size={14}
                            stroke={1.5}
                            className="mr-2"
                          />
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Transfer Ownership Confirmation */}
      <AlertDialog
        open={!!transferOwnershipMemberId}
        onOpenChange={(open) => !open && setTransferOwnershipMemberId(null)}
      >
        <AlertDialogContent className="max-w-md rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Transfer ownership
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
              This action is irreversible. You will lose owner privileges and
              become an admin of this team. The new owner will have full control
              over the team, including the ability to remove you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border-neutral-200 dark:border-border text-[13px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (transferOwnershipMemberId) {
                  transferOwnershipMutation.mutate({
                    newOwnerId: transferOwnershipMemberId,
                  });
                  setTransferOwnershipMemberId(null);
                }
              }}
              className="rounded-lg bg-amber-600 text-[13px] text-white hover:bg-amber-700"
            >
              Transfer ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

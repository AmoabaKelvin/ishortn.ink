"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  Clock,
  Copy,
  Crown,
  Link2,
  Loader2,
  Mail,
  MoreHorizontal,
  Shield,
  Trash2,
  User,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  FormLabel,
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
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const baseDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ishortn.ink";

const inviteSchema = z.object({
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  role: z.enum(["admin", "member"]).default("member"),
});

type InviteInput = z.infer<typeof inviteSchema>;

const roleConfig = {
  owner: {
    icon: Crown,
    label: "Owner",
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  admin: {
    icon: Shield,
    label: "Admin",
    className: "text-violet-700 bg-violet-50 border-violet-200",
  },
  member: {
    icon: User,
    label: "Member",
    className: "text-gray-600 bg-gray-50 border-gray-200",
  },
};

export default function TeamMembersPage() {
  const router = useRouter();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(
    null
  );
  const [transferOwnershipMemberId, setTransferOwnershipMemberId] = useState<string | null>(null);

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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isTeamWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Users className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          Team Members
        </h2>
        <p className="mt-2 max-w-sm text-center text-sm text-gray-500">
          Switch to a team workspace to manage members and their roles.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard")}
        >
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Members</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your team members and their roles.
          </p>
        </div>
        {canManageMembers && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-lg font-medium">
                  Invite member
                </DialogTitle>
                <DialogDescription className="text-sm text-gray-500">
                  Send an invite link to add someone to your team.
                </DialogDescription>
              </DialogHeader>

              {generatedInviteUrl ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center gap-2 text-sm text-emerald-700">
                      <Check className="h-4 w-4" />
                      <span className="font-medium">Invite created</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={generatedInviteUrl}
                      readOnly
                      className="h-10 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={copyInviteUrl}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button onClick={closeInviteDialog} className="w-full">
                      Done
                    </Button>
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
                          <FormLabel>Email (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="colleague@company.com"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-xs text-gray-500">
                            Leave empty to create a link-only invite.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={inviteForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="member">
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-gray-500" />
                                  <span>Member</span>
                                </div>
                              </SelectItem>
                              {isOwner && (
                                <SelectItem value="admin">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-3.5 w-3.5 text-violet-600" />
                                    <span>Admin</span>
                                  </div>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter className="gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeInviteDialog}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createInviteMutation.isLoading}
                      >
                        {createInviteMutation.isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create invite"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Members List */}
      <div className="mt-8 rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="divide-y divide-gray-100">
          {members.data?.map((member) => {
            const config = roleConfig[member.role];
            const RoleIcon = config.icon;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors duration-150"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={member.user?.imageUrl ?? undefined}
                      alt={member.user?.name ?? "User"}
                    />
                    <AvatarFallback className="bg-gray-100 text-gray-600 text-sm font-medium">
                      {member.user?.name?.[0]?.toUpperCase() ??
                        member.user?.email?.[0]?.toUpperCase() ??
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {member.user?.name || "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {member.user?.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border",
                      config.className
                    )}
                  >
                    <RoleIcon className="h-3 w-3" />
                    {config.label}
                  </span>
                  {canManageMembers && member.role !== "owner" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-gray-600"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
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
                            className="text-sm"
                          >
                            <Shield className="mr-2 h-3.5 w-3.5" />
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
                            className="text-sm"
                          >
                            <User className="mr-2 h-3.5 w-3.5" />
                            Make member
                          </DropdownMenuItem>
                        )}
                        {isOwner && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setTransferOwnershipMemberId(member.userId)}
                              className="text-sm text-amber-600"
                            >
                              <Crown className="mr-2 h-3.5 w-3.5" />
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
                          className="text-sm text-red-600"
                        >
                          <UserMinus className="mr-2 h-3.5 w-3.5" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Invites */}
      {canManageMembers && invites.data && invites.data.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-medium text-gray-900 mb-4">
            Pending invites
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="divide-y divide-gray-100">
              {invites.data.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors duration-150"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                      {invite.email ? (
                        <Mail className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Link2 className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {invite.email || "Open invite"}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>
                          {invite.isExpired
                            ? "Expired"
                            : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                        invite.isExpired
                          ? "text-red-600 bg-red-50 border-red-200"
                          : roleConfig[invite.role].className
                      )}
                    >
                      {invite.isExpired ? "Expired" : invite.role}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-gray-600"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `https://${baseDomain}/teams/accept-invite?token=${invite.token}`
                            );
                            toast.success("Link copied");
                          }}
                          className="text-sm"
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Copy link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            revokeInviteMutation.mutate({
                              inviteId: invite.id,
                            })
                          }
                          className="text-sm text-red-600"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Revoke
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Ownership Confirmation Dialog */}
      <AlertDialog
        open={!!transferOwnershipMemberId}
        onOpenChange={(open) => !open && setTransferOwnershipMemberId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer ownership</AlertDialogTitle>
            <AlertDialogDescription>
              This action is irreversible. You will lose owner privileges and become an admin of this team. The new owner will have full control over the team, including the ability to remove you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (transferOwnershipMemberId) {
                  transferOwnershipMutation.mutate({
                    newOwnerId: transferOwnershipMemberId,
                  });
                  setTransferOwnershipMemberId(null);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Transfer ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

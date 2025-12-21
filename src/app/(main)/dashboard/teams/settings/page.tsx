"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Settings, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

const updateTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(255),
});

const updateSlugSchema = z.object({
  slug: z
    .string()
    .min(3, "Team URL must be at least 3 characters")
    .max(50)
    .regex(
      slugRegex,
      "Only lowercase letters, numbers, and hyphens allowed"
    ),
});

type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
type UpdateSlugInput = z.infer<typeof updateSlugSchema>;

export default function TeamSettingsPage() {
  const router = useRouter();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const currentWorkspace = api.team.currentWorkspace.useQuery();
  const teamData = api.team.get.useQuery(undefined, {
    enabled: currentWorkspace.data?.type === "team",
  });

  const isTeamWorkspace = currentWorkspace.data?.type === "team";
  const isOwner =
    currentWorkspace.data?.type === "team" &&
    currentWorkspace.data?.role === "owner";
  const isAdmin =
    currentWorkspace.data?.type === "team" &&
    (currentWorkspace.data?.role === "owner" ||
      currentWorkspace.data?.role === "admin");

  const teamForm = useForm<UpdateTeamInput>({
    resolver: zodResolver(updateTeamSchema),
    defaultValues: {
      name: "",
    },
  });

  const slugForm = useForm<UpdateSlugInput>({
    resolver: zodResolver(updateSlugSchema),
    defaultValues: {
      slug: "",
    },
  });

  useEffect(() => {
    if (teamData.data) {
      teamForm.reset({ name: teamData.data.name });
      slugForm.reset({ slug: teamData.data.slug });
    }
  }, [teamData.data, teamForm, slugForm]);

  const newSlug = slugForm.watch("slug");
  const [debouncedSlug] = useDebounce(newSlug, 500);

  const slugCheck = api.team.checkSlug.useQuery(
    { slug: debouncedSlug },
    {
      enabled:
        !!debouncedSlug &&
        debouncedSlug.length >= 3 &&
        debouncedSlug !== teamData.data?.slug,
    }
  );

  const baseDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ishortn.ink";

  const updateTeamMutation = api.team.update.useMutation({
    onSuccess: () => {
      toast.success("Settings updated");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateSlugMutation = api.team.updateSlug.useMutation({
    onSuccess: (data) => {
      toast.success("URL updated, redirecting...");
      window.location.href = `${window.location.protocol}//${data.slug}.${baseDomain}/dashboard/teams/settings`;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteTeamMutation = api.team.delete.useMutation({
    onSuccess: () => {
      toast.success("Team deleted");
      window.location.href = `${window.location.protocol}//${baseDomain}/dashboard`;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const leaveTeamMutation = api.team.leave.useMutation({
    onSuccess: () => {
      toast.success("You have left the team");
      window.location.href = `${window.location.protocol}//${baseDomain}/dashboard`;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onUpdateTeam = async (values: UpdateTeamInput) => {
    await updateTeamMutation.mutateAsync(values);
  };

  const onUpdateSlug = async (values: UpdateSlugInput) => {
    if (values.slug === teamData.data?.slug) {
      toast.info("No changes to save");
      return;
    }
    if (!slugCheck.data?.available) {
      slugForm.setError("slug", {
        type: "manual",
        message: "This URL is already taken",
      });
      return;
    }
    await updateSlugMutation.mutateAsync(values);
  };

  const handleDeleteTeam = async () => {
    if (deleteConfirmation !== teamData.data?.name) {
      toast.error("Please type the team name correctly");
      return;
    }
    await deleteTeamMutation.mutateAsync();
  };

  if (currentWorkspace.isLoading || teamData.isLoading) {
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
          <Settings className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          Team Settings
        </h2>
        <p className="mt-2 max-w-sm text-center text-sm text-gray-500">
          Switch to a team workspace to access these settings.
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
          <h1 className="text-2xl font-semibold text-gray-900">Team settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your team configuration.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {/* General Settings */}
        <section>
          <h2 className="text-sm font-medium text-gray-900 mb-4">General</h2>
          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <Form {...teamForm}>
              <form
                onSubmit={teamForm.handleSubmit(onUpdateTeam)}
                className="space-y-4"
              >
                <FormField
                  control={teamForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Team name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Acme Inc"
                          disabled={!isAdmin}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isAdmin && (
                  <Button type="submit" disabled={updateTeamMutation.isLoading}>
                    {updateTeamMutation.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                )}
              </form>
            </Form>
          </div>
        </section>

        {/* Team URL */}
        {isOwner && (
          <section>
            <h2 className="text-sm font-medium text-gray-900 mb-4">Team URL</h2>
            <div className="p-4 rounded-lg border border-gray-200 bg-white">
              <Form {...slugForm}>
                <form
                  onSubmit={slugForm.handleSubmit(onUpdateSlug)}
                  className="space-y-4"
                >
                  <FormField
                    control={slugForm.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subdomain</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                              https://
                            </span>
                            <Input
                              placeholder="acme"
                              className="rounded-none border-x-0"
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.value.toLowerCase())
                              }
                            />
                            <span className="inline-flex h-9 items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                              .ishortn.ink
                            </span>
                          </div>
                        </FormControl>
                        {debouncedSlug &&
                          debouncedSlug.length >= 3 &&
                          debouncedSlug !== teamData.data?.slug && (
                            <div className="mt-2 flex items-center gap-1.5">
                              {slugCheck.isLoading ? (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Checking...</span>
                                </div>
                              ) : slugCheck.data?.available ? (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                  <Check className="h-3 w-3" />
                                  <span>Available</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-red-600">
                                  <X className="h-3 w-3" />
                                  <span>Already taken</span>
                                </div>
                              )}
                            </div>
                          )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Changing the URL will require members to update bookmarks.
                  </p>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={
                      updateSlugMutation.isLoading ||
                      slugCheck.isLoading ||
                      (debouncedSlug !== teamData.data?.slug &&
                        !slugCheck.data?.available)
                    }
                  >
                    {updateSlugMutation.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update URL"
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          </section>
        )}

        {/* Danger Zone */}
        <section>
          <h2 className="text-sm font-medium text-red-600 mb-4">Danger zone</h2>
          <div className="p-4 rounded-lg border border-red-200 bg-red-50/50">
            {!isOwner ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Leave team</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Remove yourself from this team.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                      Leave
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave team?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You'll need to be invited again to rejoin.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => leaveTeamMutation.mutate()}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {leaveTeamMutation.isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Leaving...
                          </>
                        ) : (
                          "Leave team"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Delete team</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permanently delete this team and all resources.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete team?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. Type{" "}
                        <span className="font-medium text-foreground">
                          {teamData.data?.name}
                        </span>{" "}
                        to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="Type team name"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteTeam}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={
                          deleteConfirmation !== teamData.data?.name ||
                          deleteTeamMutation.isLoading
                        }
                      >
                        {deleteTeamMutation.isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Delete team"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

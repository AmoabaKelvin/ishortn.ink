"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconCheck,
  IconLoader2,
  IconSettings,
  IconX,
} from "@tabler/icons-react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { APP_BASE_DOMAIN, getAppBaseDomain } from "@/lib/constants/domains";
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

  const baseDomain = getAppBaseDomain();

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
      <div className="flex min-h-[400px] items-center justify-center">
        <IconLoader2 size={20} stroke={1.5} className="animate-spin text-neutral-400 dark:text-neutral-500" />
      </div>
    );
  }

  if (!isTeamWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
          <IconSettings size={20} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
        </div>
        <p className="mt-4 text-[14px] font-medium text-neutral-900 dark:text-foreground">
          Team Settings
        </p>
        <p className="mt-1 max-w-sm text-center text-[13px] text-neutral-400 dark:text-neutral-500">
          Switch to a team workspace to access these settings.
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
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Team settings
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
          Manage your team configuration.
        </p>
      </div>

      <div className="space-y-8">
        {/* General Settings */}
        <section>
          <h2 className="mb-3 text-[14px] font-semibold text-neutral-900 dark:text-foreground">
            General
          </h2>
          <div className="rounded-xl border border-neutral-200 dark:border-border p-5">
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
                      <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                        Team name
                      </label>
                      <FormControl>
                        <Input
                          placeholder="Acme Inc"
                          disabled={!isAdmin}
                          className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
                {isAdmin && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={updateTeamMutation.isLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updateTeamMutation.isLoading && (
                        <IconLoader2 size={14} stroke={1.5} className="animate-spin" />
                      )}
                      Save
                    </button>
                  </div>
                )}
              </form>
            </Form>
          </div>
        </section>

        {/* Team URL */}
        {isOwner && (
          <section>
            <h2 className="mb-3 text-[14px] font-semibold text-neutral-900 dark:text-foreground">
              Team URL
            </h2>
            <div className="rounded-xl border border-neutral-200 dark:border-border p-5">
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
                        <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                          Subdomain
                        </label>
                        <FormControl>
                          <div className="flex items-center">
                            <span className="inline-flex h-9 items-center rounded-l-lg border border-r-0 border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-3 text-[13px] text-neutral-400 dark:text-neutral-500">
                              https://
                            </span>
                            <Input
                              placeholder="acme"
                              className="h-9 rounded-none border-x-0 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                              {...field}
                              onChange={(e) =>
                                field.onChange(e.target.value.toLowerCase())
                              }
                            />
                            <span className="inline-flex h-9 items-center rounded-r-lg border border-l-0 border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-3 text-[13px] text-neutral-400 dark:text-neutral-500">
                              .{APP_BASE_DOMAIN}
                            </span>
                          </div>
                        </FormControl>
                        {debouncedSlug &&
                          debouncedSlug.length >= 3 &&
                          debouncedSlug !== teamData.data?.slug && (
                            <div className="mt-2 flex items-center gap-1.5">
                              {slugCheck.isLoading ? (
                                <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                                  <IconLoader2 size={12} stroke={1.5} className="animate-spin" />
                                  Checking...
                                </div>
                              ) : slugCheck.data?.available ? (
                                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                                  <IconCheck size={12} stroke={1.5} />
                                  Available
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                                  <IconX size={12} stroke={1.5} />
                                  Already taken
                                </div>
                              )}
                            </div>
                          )}
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                    Changing the URL will require members to update bookmarks.
                  </p>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={
                        updateSlugMutation.isLoading ||
                        slugCheck.isLoading ||
                        (debouncedSlug !== teamData.data?.slug &&
                          !slugCheck.data?.available)
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-border px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50 disabled:opacity-50"
                    >
                      {updateSlugMutation.isLoading && (
                        <IconLoader2 size={14} stroke={1.5} className="animate-spin" />
                      )}
                      Update URL
                    </button>
                  </div>
                </form>
              </Form>
            </div>
          </section>
        )}

        {/* Danger Zone */}
        <section>
          <h2 className="mb-3 text-[14px] font-semibold text-red-600 dark:text-red-400">
            Danger zone
          </h2>
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50/30 p-5">
            {!isOwner ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground">Leave team</p>
                  <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">
                    Remove yourself from this team.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-[12px] font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      Leave
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-md rounded-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
                        Leave team?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
                        You&apos;ll need to be invited again to rejoin.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-lg border-neutral-200 dark:border-border text-[13px]">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => leaveTeamMutation.mutate()}
                        className="rounded-lg bg-red-600 text-[13px] text-white hover:bg-red-700"
                      >
                        {leaveTeamMutation.isLoading ? (
                          <>
                            <IconLoader2 size={14} stroke={1.5} className="mr-1.5 animate-spin" />
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
                  <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground">Delete team</p>
                  <p className="mt-0.5 text-[12px] text-neutral-400 dark:text-neutral-500">
                    Permanently delete this team and all resources.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-md rounded-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-[14px] font-semibold text-neutral-900 dark:text-foreground">
                        Delete team?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
                        This action cannot be undone. Type{" "}
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {teamData.data?.name}
                        </span>{" "}
                        to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="Type team name"
                      className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => setDeleteConfirmation("")}
                        className="rounded-lg border-neutral-200 dark:border-border text-[13px]"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteTeam}
                        className="rounded-lg bg-red-600 text-[13px] text-white hover:bg-red-700"
                        disabled={
                          deleteConfirmation !== teamData.data?.name ||
                          deleteTeamMutation.isLoading
                        }
                      >
                        {deleteTeamMutation.isLoading ? (
                          <>
                            <IconLoader2 size={14} stroke={1.5} className="mr-1.5 animate-spin" />
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

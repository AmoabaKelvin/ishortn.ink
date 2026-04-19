"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconCheck,
  IconDiamond,
  IconLoader2,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DEFAULT_PLATFORM_DOMAIN, getAppBaseDomain } from "@/lib/constants/domains";
import { api } from "@/trpc/react";

const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

const createTeamSchema = z.object({
  name: z
    .string()
    .min(1, "Team name is required")
    .max(255, "Team name is too long"),
  slug: z
    .string()
    .min(3, "Team URL must be at least 3 characters")
    .max(50, "Team URL is too long")
    .regex(
      slugRegex,
      "Only lowercase letters, numbers, and hyphens allowed"
    ),
});

type CreateTeamInput = z.infer<typeof createTeamSchema>;

export default function CreateTeamPage() {
  const router = useRouter();
  const [slugTouched, setSlugTouched] = useState(false);

  const form = useForm<CreateTeamInput>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const teamName = form.watch("name");
  const slug = form.watch("slug");
  const [debouncedSlug] = useDebounce(slug, 500);

  useEffect(() => {
    if (!slugTouched && teamName) {
      const generatedSlug = teamName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      form.setValue("slug", generatedSlug);
    }
  }, [teamName, slugTouched, form]);

  const slugCheck = api.team.checkSlug.useQuery(
    { slug: debouncedSlug },
    {
      enabled: !!debouncedSlug && debouncedSlug.length >= 3,
    }
  );

  const subscription = api.subscriptions.get.useQuery();

  const createTeamMutation = api.team.create.useMutation({
    onSuccess: (data) => {
      toast.success("Team created successfully!");
      const baseDomain = getAppBaseDomain();
      window.location.href = `${window.location.protocol}//${data.slug}.${baseDomain}/dashboard`;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = async (values: CreateTeamInput) => {
    if (!slugCheck.data?.available) {
      form.setError("slug", {
        type: "manual",
        message: "This URL is already taken",
      });
      return;
    }
    await createTeamMutation.mutateAsync(values);
  };

  const canCreateTeam = subscription.data?.canCreateTeam ?? false;
  const isLoading = subscription.isLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <IconLoader2 size={20} stroke={1.5} className="animate-spin text-neutral-400 dark:text-neutral-500" />
      </div>
    );
  }

  if (!canCreateTeam) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-muted">
          <IconUsers size={20} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
        </div>
        <p className="mt-4 text-[14px] font-medium text-neutral-900 dark:text-foreground">
          Create a Team
        </p>
        <p className="mt-1 max-w-sm text-center text-[13px] text-neutral-400 dark:text-neutral-500">
          Set up a shared workspace to collaborate with your team members.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-3 py-1.5 text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
          <IconDiamond size={14} stroke={1.5} className="text-neutral-400 dark:text-neutral-500" />
          Available on Ultra plan
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-foreground">
          Create a team
        </h1>
        <p className="mt-1 text-[13px] text-neutral-400 dark:text-neutral-500">
          Set up a shared workspace for your organization.
        </p>
      </div>

      <div className="max-w-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    Team name
                  </label>
                  <FormControl>
                    <Input
                      placeholder="Acme Inc"
                      className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    Team URL
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
                        onChange={(e) => {
                          setSlugTouched(true);
                          field.onChange(e.target.value.toLowerCase());
                        }}
                      />
                      <span className="inline-flex h-9 items-center rounded-r-lg border border-l-0 border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 px-3 text-[13px] text-neutral-400 dark:text-neutral-500">
                        .{DEFAULT_PLATFORM_DOMAIN}
                      </span>
                    </div>
                  </FormControl>
                  {debouncedSlug && debouncedSlug.length >= 3 && (
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

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 rounded-lg border border-neutral-200 dark:border-border px-4 py-2 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-neutral-50 dark:hover:bg-accent/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  createTeamMutation.isLoading ||
                  !slugCheck.data?.available ||
                  slugCheck.isLoading
                }
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {createTeamMutation.isLoading && (
                  <IconLoader2 size={14} stroke={1.5} className="animate-spin" />
                )}
                Create team
              </button>
            </div>
          </form>
        </Form>

        <div className="mt-8 rounded-lg border border-neutral-200 dark:border-border bg-neutral-50 dark:bg-accent/50 p-4">
          <p className="text-[12px] leading-relaxed text-neutral-400 dark:text-neutral-500">
            Your team will have its own workspace at{" "}
            <span className="font-mono text-neutral-600 dark:text-neutral-400">
              {slug || "your-team"}.{DEFAULT_PLATFORM_DOMAIN}
            </span>
            . You&apos;ll be the owner with full access and can invite members after setup.
          </p>
        </div>
      </div>
    </div>
  );
}

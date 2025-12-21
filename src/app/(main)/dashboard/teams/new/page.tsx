"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import { z } from "zod";

import { Gem } from "lucide-react";

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
      const baseDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "ishortn.ink";
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

  // Use canCreateTeam which checks the user's personal subscription
  // This prevents team workspace members from seeing the create form
  const canCreateTeam = subscription.data?.canCreateTeam ?? false;
  const isLoading = subscription.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!canCreateTeam) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Users className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          Create a Team
        </h2>
        <p className="mt-2 max-w-sm text-center text-sm text-gray-500">
          Set up a shared workspace to collaborate with your team members.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-full border border-gray-300 bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800">
          <Gem className="h-4 w-4 text-slate-500" />
          <span>Available on Ultra plan</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Create a team</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set up a shared workspace for your organization.
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team URL</FormLabel>
                  <FormControl>
                    <div className="flex items-center">
                      <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                        https://
                      </span>
                      <Input
                        placeholder="acme"
                        className="rounded-none border-x-0"
                        {...field}
                        onChange={(e) => {
                          setSlugTouched(true);
                          field.onChange(e.target.value.toLowerCase());
                        }}
                      />
                      <span className="inline-flex h-9 items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                        .ishortn.ink
                      </span>
                    </div>
                  </FormControl>
                  {debouncedSlug && debouncedSlug.length >= 3 && (
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

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={
                  createTeamMutation.isLoading ||
                  !slugCheck.data?.available ||
                  slugCheck.isLoading
                }
              >
                {createTeamMutation.isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create team"
                )}
              </Button>
            </div>
          </form>
        </Form>

        <div className="mt-8 p-4 rounded-lg bg-muted border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your team will have its own workspace at{" "}
            <span className="font-mono text-foreground">
              {slug || "your-team"}.ishortn.ink
            </span>
            . You'll be the owner with full access and can invite members after setup.
          </p>
        </div>
      </div>
    </div>
  );
}

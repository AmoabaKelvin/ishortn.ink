"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
});

type ProfileFormProps = {
  userProfile: RouterOutputs["user"]["getProfile"];
};

export function ProfileForm({ userProfile }: ProfileFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const utils = api.useUtils();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: userProfile?.name ?? "",
    },
  });

  const { mutate: updateProfile } = api.user.updateProfile.useMutation({
    onSuccess: async () => {
      setIsSaving(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      await utils.user.getProfile.invalidate();
      toast.success("Profile updated");
    },
    onError: (error) => {
      setIsSaving(false);
      toast.error(error.message);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    updateProfile(values);
  }

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-border p-5">
      {/* User info */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-muted text-[14px] font-medium text-neutral-600 dark:text-neutral-400">
          {userProfile?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div>
          <p className="text-[14px] font-medium text-neutral-900 dark:text-foreground">
            {userProfile?.name ?? "Your Name"}
          </p>
          <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
            {userProfile?.email ?? "email@example.com"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  Display Name
                </label>
                <FormControl>
                  <Input
                    placeholder="Enter your name"
                    className="h-9 border-neutral-200 dark:border-border bg-white dark:bg-card text-[13px] placeholder:text-neutral-400"
                    {...field}
                  />
                </FormControl>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  This is how your name will appear across the platform.
                </p>
                <FormMessage className="text-[11px]" />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSaving || !form.formState.isDirty}
              className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <IconLoader2
                    size={14}
                    stroke={1.5}
                    className="mr-1.5 animate-spin"
                  />
                  Saving...
                </>
              ) : justSaved ? (
                <>
                  <IconCheck size={14} stroke={1.5} className="mr-1.5" />
                  Saved
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

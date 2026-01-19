"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, User, Check } from "lucide-react";
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
      toast.success("Profile updated successfully");
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
    <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
      {/* Avatar Section */}
      <div className="relative bg-gradient-to-br from-neutral-50 to-neutral-100/50 px-6 py-8 border-b border-neutral-100">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-2xl font-semibold shadow-lg shadow-amber-500/25">
              {userProfile?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <Check className="w-3 h-3 text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">
              {userProfile?.name ?? "Your Name"}
            </h3>
            <p className="text-sm text-neutral-500 flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {userProfile?.email ?? "email@example.com"}
            </p>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-700 flex items-center gap-2">
                      <User className="w-4 h-4 text-neutral-400" />
                      Display Name
                    </label>
                    <FormControl>
                      <Input
                        placeholder="Enter your name"
                        className="h-11 rounded-xl border-neutral-200 bg-neutral-50/50 focus:bg-white focus:border-amber-300 focus:ring-amber-200 transition-colors"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-neutral-400">
                      This is how your name will appear across the platform.
                    </p>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Email verified
              </div>
              <Button
                type="submit"
                disabled={isSaving || !form.formState.isDirty}
                className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl px-5 h-10 shadow-sm transition-all duration-200 hover:shadow-md disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : justSaved ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
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
    </div>
  );
}

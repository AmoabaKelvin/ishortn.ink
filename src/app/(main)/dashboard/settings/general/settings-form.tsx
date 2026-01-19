"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Globe, Loader2, Check } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

const formSchema = z.object({
  defaultDomain: z.string(),
});

type SettingsFormProps = {
  userSettings: RouterOutputs["siteSettings"]["get"];
  availableDomains: RouterOutputs["customDomain"]["list"];
};

export function SettingsForm({
  userSettings,
  availableDomains,
}: SettingsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      defaultDomain: userSettings!.defaultDomain!,
    },
  });

  const { mutate: updateSettings } = api.siteSettings.update.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      toast.success("Settings updated successfully");
    },
    onError: (error) => {
      setIsSaving(false);
      toast.error(error.message);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    updateSettings(values);
  }

  const activeDomains = [
    { domain: "ishortn.ink", status: "active" as const },
    ...availableDomains.filter((d) => d.status === "active"),
  ];

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-neutral-100 bg-gradient-to-br from-neutral-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <Globe className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-medium text-neutral-900">Default Domain</h3>
            <p className="text-sm text-neutral-500">
              Used when creating quick shortened links
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="defaultDomain"
              render={({ field }) => (
                <FormItem>
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-neutral-700">
                      Select Domain
                    </label>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-12 rounded-xl border-neutral-200 bg-neutral-50/50 focus:bg-white focus:border-blue-300 focus:ring-blue-200 transition-colors">
                          <SelectValue placeholder="Select a domain" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl border-neutral-200 shadow-lg">
                        {activeDomains.map((domain) => (
                          <SelectItem
                            key={domain.domain}
                            value={domain.domain!}
                            className="rounded-lg py-3 px-3 focus:bg-blue-50 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neutral-100 to-neutral-50 flex items-center justify-center border border-neutral-200/50">
                                <Globe className="w-4 h-4 text-neutral-500" />
                              </div>
                              <span className="font-medium">{domain.domain}</span>
                              {domain.status === "active" && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-neutral-400">
                      You can add custom domains in the{" "}
                      <a href="/dashboard/domains" className="text-blue-600 hover:underline">
                        Domains
                      </a>{" "}
                      section.
                    </p>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-2">
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

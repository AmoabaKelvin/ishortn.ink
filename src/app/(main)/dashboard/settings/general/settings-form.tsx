"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      defaultDomain: userSettings!.defaultDomain!,
    },
  });

  const { mutate: updateSettings } = api.siteSettings.update.useMutation({
    onSuccess: () => {
      setIsSaving(false);
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
    <Card>
      <CardHeader>
        <CardTitle>Default Domain</CardTitle>
        <CardDescription>
          Choose the default domain to use when creating quick shortened links.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="defaultDomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a domain" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeDomains.map((domain) => (
                        <SelectItem key={domain.domain} value={domain.domain!}>
                          <div className="flex items-center gap-2">
                            <span>{domain.domain}</span>
                            {domain.status === "active" && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    This domain will be used as the default when creating quick
                    shortened links.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

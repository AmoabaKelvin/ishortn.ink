"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileText,
  Flag,
  Globe,
  MessageSquare,
  Search
} from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";

import type { UtmTemplate } from "@/server/db/schema";

const utmTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(100),
  utmSource: z.string().max(255).optional(),
  utmMedium: z.string().max(255).optional(),
  utmCampaign: z.string().max(255).optional(),
  utmTerm: z.string().max(255).optional(),
  utmContent: z.string().max(255).optional(),
});

type UtmTemplateFormValues = z.infer<typeof utmTemplateSchema>;

type UtmTemplateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: UtmTemplate | null;
  onSuccess?: () => void;
};

const utmFields = [
  {
    name: "utmSource" as const,
    label: "Source",
    placeholder: "google",
    icon: Globe,
  },
  {
    name: "utmMedium" as const,
    label: "Medium",
    placeholder: "cpc",
    icon: MessageSquare,
  },
  {
    name: "utmCampaign" as const,
    label: "Campaign",
    placeholder: "summer sale",
    icon: Flag,
  },
  {
    name: "utmTerm" as const,
    label: "Term",
    placeholder: "running shoes",
    icon: Search,
  },
  {
    name: "utmContent" as const,
    label: "Content",
    placeholder: "logo link",
    icon: FileText,
  },
];

export function UtmTemplateModal({
  open,
  onOpenChange,
  template,
  onSuccess,
}: UtmTemplateModalProps) {
  const utils = api.useUtils();
  const isEditing = !!template;

  const form = useForm<UtmTemplateFormValues>({
    resolver: zodResolver(utmTemplateSchema),
    defaultValues: {
      name: "",
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      utmTerm: "",
      utmContent: "",
    },
  });

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        utmSource: template.utmSource ?? "",
        utmMedium: template.utmMedium ?? "",
        utmCampaign: template.utmCampaign ?? "",
        utmTerm: template.utmTerm ?? "",
        utmContent: template.utmContent ?? "",
      });
    } else {
      form.reset({
        name: "",
        utmSource: "",
        utmMedium: "",
        utmCampaign: "",
        utmTerm: "",
        utmContent: "",
      });
    }
  }, [template, form]);

  const createMutation = api.utmTemplate.create.useMutation({
    onSuccess: () => {
      toast.success("Template created successfully");
      utils.utmTemplate.list.invalidate();
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = api.utmTemplate.update.useMutation({
    onSuccess: () => {
      toast.success("Template updated successfully");
      utils.utmTemplate.list.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (values: UtmTemplateFormValues) => {
    if (isEditing && template) {
      updateMutation.mutate({
        id: template.id,
        ...values,
      });
    } else {
      createMutation.mutate(values);
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isEditing ? "Edit UTM Template" : "Create UTM Template"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Template Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-gray-900">
                    Template Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="New Template"
                      className="h-11 rounded-lg"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* UTM Parameters */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900">Parameters</p>
              <div className="space-y-3">
                {utmFields.map((field) => {
                  const Icon = field.icon;
                  return (
                    <FormField
                      key={field.name}
                      control={form.control}
                      name={field.name}
                      render={({ field: formField }) => (
                        <FormItem>
                          <FormControl>
                            <div className="flex items-center overflow-hidden rounded-lg border border-gray-200">
                              <div className="flex w-36 shrink-0 items-center gap-2.5 border-r border-gray-200 px-4 py-3">
                                <Icon className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-700">
                                  {field.label}
                                </span>
                              </div>
                              <Input
                                {...formField}
                                placeholder={field.placeholder}
                                className="h-auto border-0 py-3 focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="px-6">
                {isLoading
                  ? "Saving..."
                  : isEditing
                  ? "Update template"
                  : "Create template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import {
  FileText,
  Flag,
  Globe,
  MessageSquare,
  Search,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type UtmParamsFormProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  disabled?: boolean;
};

const utmFields = [
  {
    name: "utmParams.utm_source",
    label: "Source",
    placeholder: "google",
    icon: Globe,
  },
  {
    name: "utmParams.utm_medium",
    label: "Medium",
    placeholder: "cpc",
    icon: MessageSquare,
  },
  {
    name: "utmParams.utm_campaign",
    label: "Campaign",
    placeholder: "summer sale",
    icon: Flag,
  },
  {
    name: "utmParams.utm_term",
    label: "Term",
    placeholder: "running shoes",
    icon: Search,
  },
  {
    name: "utmParams.utm_content",
    label: "Content",
    placeholder: "logo link",
    icon: FileText,
  },
];

export function UtmParamsForm({ form, disabled = false }: UtmParamsFormProps) {
  return (
    <div className="space-y-3">
      {utmFields.map((field) => {
        const Icon = field.icon;
        return (
          <FormField
            key={field.name}
            control={form.control}
            name={field.name}
            disabled={disabled}
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
                      disabled={disabled}
                    />
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
        );
      })}
    </div>
  );
}

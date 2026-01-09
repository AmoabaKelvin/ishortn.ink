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
    <div className="space-y-2">
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
                  <div className={`flex h-9 w-full items-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors ${disabled ? "opacity-50" : "hover:border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20"}`}>
                    <div className="flex h-full w-28 shrink-0 items-center gap-2 border-r border-gray-200 px-3">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">
                        {field.label}
                      </span>
                    </div>
                    <input
                      {...formField}
                      placeholder={field.placeholder}
                      className="h-full flex-1 border-0 bg-transparent px-3 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed"
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

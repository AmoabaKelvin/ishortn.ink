"use client";

import {
  IconFileText,
  IconSearch,
  IconSend,
  IconSpeakerphone,
  IconWorld,
} from "@tabler/icons-react";
import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";

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
    icon: IconWorld,
  },
  {
    name: "utmParams.utm_medium",
    label: "Medium",
    placeholder: "cpc",
    icon: IconSend,
  },
  {
    name: "utmParams.utm_campaign",
    label: "Campaign",
    placeholder: "summer sale",
    icon: IconSpeakerphone,
  },
  {
    name: "utmParams.utm_term",
    label: "Term",
    placeholder: "running shoes",
    icon: IconSearch,
  },
  {
    name: "utmParams.utm_content",
    label: "Content",
    placeholder: "logo link",
    icon: IconFileText,
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
              <FormItem className="space-y-0">
                <div
                  className={cn(
                    "flex h-9 w-full items-center overflow-hidden rounded-lg border border-neutral-200 dark:border-border bg-white dark:bg-card transition-colors",
                    disabled
                      ? "opacity-50"
                      : "hover:border-neutral-300 focus-within:border-neutral-300 focus-within:ring-1 focus-within:ring-neutral-300"
                  )}
                >
                  <FormLabel className="flex h-full w-28 shrink-0 cursor-pointer items-center gap-2 border-r border-neutral-200 dark:border-border px-3 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    <Icon size={14} stroke={1.5} className="text-neutral-400" />
                    {field.label}
                  </FormLabel>
                  <FormControl>
                    <input
                      {...formField}
                      placeholder={field.placeholder}
                      className="h-full flex-1 border-0 bg-transparent px-3 text-[13px] font-medium text-neutral-900 dark:text-foreground placeholder:text-neutral-400 focus:outline-none disabled:cursor-not-allowed"
                      disabled={disabled}
                    />
                  </FormControl>
                </div>
              </FormItem>
            )}
          />
        );
      })}
    </div>
  );
}

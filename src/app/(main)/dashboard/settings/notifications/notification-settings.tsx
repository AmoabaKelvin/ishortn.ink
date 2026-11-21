"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { api } from "@/trpc/react";

type NotificationSettingsProps = {
  productEmailsEnabled: boolean;
};

export function NotificationSettings({ productEmailsEnabled }: NotificationSettingsProps) {
  const [enabled, setEnabled] = useState(productEmailsEnabled);

  const updatePreferences = api.user.updateNotificationPreferences.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.productEmailsEnabled
          ? "Product notification emails turned on"
          : "Product notification emails turned off",
      );
    },
    onError: (error, variables) => {
      setEnabled(!variables.productEmailsEnabled);
      toast.error(error.message);
    },
  });

  const handleChange = (checked: boolean) => {
    setEnabled(checked);
    updatePreferences.mutate({ productEmailsEnabled: checked });
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <label
            htmlFor="product-emails"
            className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
          >
            Product notification emails
          </label>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
            Link click milestones, monthly analytics usage alerts, reminders to finish setting up a
            custom domain and one reminder to create your first link. Account, billing and team
            emails are always sent.
          </p>
        </div>
        <Switch
          id="product-emails"
          checked={enabled}
          disabled={updatePreferences.isLoading}
          onCheckedChange={handleChange}
          className="mt-0.5 shrink-0"
        />
      </div>
    </div>
  );
}

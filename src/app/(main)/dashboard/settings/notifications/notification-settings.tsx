"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { api } from "@/trpc/react";

type NotificationSettingsProps = {
  productEmailsEnabled: boolean;
  weeklySummaryEnabled: boolean;
};

export function NotificationSettings({
  productEmailsEnabled,
  weeklySummaryEnabled,
}: NotificationSettingsProps) {
  const [productEnabled, setProductEnabled] = useState(productEmailsEnabled);
  const [weeklyEnabled, setWeeklyEnabled] = useState(weeklySummaryEnabled);

  const updatePreferences = api.user.updateNotificationPreferences.useMutation({
    onSuccess: (data) => {
      if (data.productEmailsEnabled !== undefined) {
        toast.success(
          data.productEmailsEnabled
            ? "Product notification emails turned on"
            : "Product notification emails turned off",
        );
      } else {
        toast.success(
          data.weeklySummaryEnabled ? "Weekly summary turned on" : "Weekly summary turned off",
        );
      }
    },
    onError: (error, variables) => {
      if (variables.productEmailsEnabled !== undefined) {
        setProductEnabled(!variables.productEmailsEnabled);
      }
      if (variables.weeklySummaryEnabled !== undefined) {
        setWeeklyEnabled(!variables.weeklySummaryEnabled);
      }
      toast.error(error.message);
    },
  });

  const handleProductChange = (checked: boolean) => {
    setProductEnabled(checked);
    updatePreferences.mutate({ productEmailsEnabled: checked });
  };

  const handleWeeklyChange = (checked: boolean) => {
    setWeeklyEnabled(checked);
    updatePreferences.mutate({ weeklySummaryEnabled: checked });
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-border">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <label
            htmlFor="product-emails"
            className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
          >
            Product notification emails
          </label>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
            Link click milestones, monthly tracked-click usage alerts, reminders to finish setting
            up a custom domain, one reminder to create your first link, and occasional product
            updates and offers. Account, billing and team emails are always sent.
          </p>
        </div>
        <Switch
          id="product-emails"
          checked={productEnabled}
          disabled={updatePreferences.isLoading}
          onCheckedChange={handleProductChange}
          className="mt-0.5 shrink-0"
        />
      </div>

      {/* Weekly summary: only sent while product emails are on */}
      <div className="flex items-start justify-between gap-4 border-t border-neutral-100 p-5 dark:border-border/50">
        <div className="min-w-0 space-y-1">
          <label
            htmlFor="weekly-summary"
            className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
          >
            Weekly summary
          </label>
          <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
            {productEnabled
              ? "A Monday email with last week's clicks, top links, top country and top source, sent when your links got at least 5 clicks."
              : "Turn on product notification emails to get the weekly summary."}
          </p>
        </div>
        <Switch
          id="weekly-summary"
          checked={productEnabled && weeklyEnabled}
          disabled={!productEnabled || updatePreferences.isLoading}
          onCheckedChange={handleWeeklyChange}
          className="mt-0.5 shrink-0"
        />
      </div>
    </div>
  );
}

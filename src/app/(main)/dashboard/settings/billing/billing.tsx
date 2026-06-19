"use client";

import { format } from "date-fns";
import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getIntervalFromVariantId } from "@/lib/billing/plans";
import { api } from "@/trpc/react";

import { PlanSwitcher } from "./plan-switcher";

import type { RouterOutputs } from "@/trpc/shared";

type BillingProps = {
  subscriptions: RouterOutputs["subscriptions"]["get"];
};

export default function Billing({ subscriptions }: BillingProps) {
  const [isLoading, setIsLoading] = useState(false);

  const subscription = subscriptions?.subscriptions;
  const currentPlan = subscriptions?.plan ?? "free";
  const currentInterval = getIntervalFromVariantId(subscription?.variantId);
  const isActive = subscription?.status === "active";

  const getSubscriptionDetails =
    api.lemonsqueezy.subscriptionDetails.useMutation({
      onSuccess: (urls) => {
        if (urls.customer_portal) {
          window.location.href = urls.customer_portal;
        } else if (urls.update_payment_method) {
          window.location.href = urls.update_payment_method;
        } else {
          toast.error("Could not find subscription portal URL");
          setIsLoading(false);
        }
      },
      onError: (error) => {
        toast.error(error.message);
        setIsLoading(false);
      },
    });

  const handleManageSubscription = () => {
    setIsLoading(true);
    getSubscriptionDetails.mutate();
  };

  return (
    <div className="space-y-5 rounded-xl border border-neutral-200 dark:border-border p-5">
      {/* Current plan summary */}
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-medium capitalize text-neutral-900 dark:text-foreground">
            {currentPlan} Plan
          </p>
          {subscription && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  isActive ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              {subscription.status}
            </span>
          )}
        </div>

        {subscription ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
            {subscription.renewsAt && (
              <span className="text-neutral-400 dark:text-neutral-500">
                Renews {format(new Date(subscription.renewsAt), "MMM d, yyyy")}
              </span>
            )}
            {subscription.cardLastFour && (
              <>
                {subscription.renewsAt && (
                  <span className="text-neutral-300 dark:text-neutral-600">&middot;</span>
                )}
                <span className="capitalize text-neutral-500 dark:text-neutral-400">
                  {subscription.cardBrand} &bull;&bull;&bull;&bull;{" "}
                  {subscription.cardLastFour}
                </span>
              </>
            )}
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-neutral-400 dark:text-neutral-500">
            Upgrade for unlimited links, custom domains, and advanced analytics.
          </p>
        )}

        {subscription && (
          <div className="mt-3">
            <Button
              onClick={handleManageSubscription}
              disabled={isLoading}
              variant="outline"
              className="h-8 border-neutral-200 dark:border-border text-[12px]"
            >
              {isLoading && (
                <IconLoader2
                  size={14}
                  stroke={1.5}
                  className="mr-1.5 animate-spin"
                />
              )}
              Manage Subscription
            </Button>
          </div>
        )}
      </div>

      {/* Inline plan switcher */}
      <div className="border-t border-neutral-100 dark:border-border/50 pt-5">
        <PlanSwitcher
          currentPlan={currentPlan}
          currentInterval={currentInterval}
        />
      </div>
    </div>
  );
}

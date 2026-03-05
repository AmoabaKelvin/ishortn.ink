"use client";

import { format } from "date-fns";
import { IconArrowRight, IconLoader2 } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

import type { RouterOutputs } from "@/trpc/shared";

type BillingProps = {
  subscriptions: RouterOutputs["subscriptions"]["get"];
};

export default function Billing({ subscriptions }: BillingProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const subscription = subscriptions?.subscriptions;

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

  if (!subscription) {
    return (
      <div className="rounded-xl border border-neutral-200 p-5">
        <p className="text-[14px] font-medium text-neutral-900">Free Plan</p>
        <p className="mt-1 text-[12px] text-neutral-400">
          Upgrade to Pro for unlimited links, custom domains, and advanced
          analytics.
        </p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/pricing")}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
        >
          View Plans
          <IconArrowRight size={14} stroke={1.5} />
        </button>
      </div>
    );
  }

  const isActive = subscription.status === "active";

  return (
    <div className="rounded-xl border border-neutral-200 p-5">
      <div className="flex items-center gap-2">
        <p className="text-[14px] font-medium capitalize text-neutral-900">
          {subscriptions?.plan ? `${subscriptions.plan} Plan` : "Free Plan"}
        </p>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
            isActive ? "text-emerald-600" : "text-red-600"
          }`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isActive ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          {subscription.status}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
        {subscription.renewsAt && (
          <span className="text-neutral-400">
            Renews {format(new Date(subscription.renewsAt), "MMM d, yyyy")}
          </span>
        )}
        {subscription.cardLastFour && (
          <>
            {subscription.renewsAt && (
              <span className="text-neutral-300">&middot;</span>
            )}
            <span className="capitalize text-neutral-500">
              {subscription.cardBrand} &bull;&bull;&bull;&bull;{" "}
              {subscription.cardLastFour}
            </span>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-4">
        <Button
          onClick={handleManageSubscription}
          disabled={isLoading}
          variant="outline"
          className="h-9 border-neutral-200 text-[13px]"
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
        <Button
          onClick={() => router.push("/dashboard/pricing")}
          className="h-9 bg-blue-600 text-[13px] hover:bg-blue-700"
        >
          Change Plan
        </Button>
      </div>
    </div>
  );
}

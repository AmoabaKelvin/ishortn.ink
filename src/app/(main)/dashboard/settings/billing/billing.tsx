"use client";

import { format } from "date-fns";
import { CreditCard, Loader2, Sparkles, Calendar, ArrowRight, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { RouterOutputs } from "@/trpc/shared";

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
      <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
        {/* Upgrade Banner */}
        <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-6 py-8 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')] opacity-[0.08]" />
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 text-white/90 text-xs font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Free Plan
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">
              Unlock more power
            </h3>
            <p className="text-white/80 text-sm max-w-md">
              Upgrade to Pro for unlimited links, custom domains, advanced analytics, and priority support.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="p-6 bg-gradient-to-b from-neutral-50/50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-neutral-900">Ready to upgrade?</p>
                <p className="text-sm text-neutral-500">See what Pro can do for you</p>
              </div>
            </div>
            <Button
              onClick={() => router.push("/dashboard/pricing")}
              className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl px-5 h-10 shadow-sm transition-all duration-200 hover:shadow-md group"
            >
              View Plans
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isActive = subscription.status === "active";

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
      {/* Status Header */}
      <div className="relative px-6 py-6 border-b border-neutral-100 bg-gradient-to-br from-neutral-50/50 to-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isActive
                ? "bg-gradient-to-br from-emerald-100 to-teal-100"
                : "bg-gradient-to-br from-red-100 to-rose-100"
            }`}>
              <Sparkles className={`w-6 h-6 ${isActive ? "text-emerald-600" : "text-red-600"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-neutral-900 capitalize">
                  {subscriptions?.plan ? `${subscriptions.plan} Plan` : "Free Plan"}
                </h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {subscription.status}
                </span>
              </div>
              <p className="text-sm text-neutral-500 mt-0.5">
                Your subscription is currently {isActive ? "active" : "inactive"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Renewal Date */}
          <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-neutral-200/50 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-neutral-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
                  Renews
                </p>
                <p className="font-medium text-neutral-900 mt-0.5">
                  {subscription.renewsAt
                    ? format(new Date(subscription.renewsAt), "MMM d, yyyy")
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          {subscription.cardLastFour && (
            <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white border border-neutral-200/50 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-neutral-500" />
                </div>
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">
                    Payment
                  </p>
                  <p className="font-medium text-neutral-900 mt-0.5 capitalize">
                    {subscription.cardBrand} •••• {subscription.cardLastFour}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-6 pt-6 border-t border-neutral-100">
          <Button
            onClick={handleManageSubscription}
            disabled={isLoading}
            variant="outline"
            className="rounded-xl h-10 border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Manage Subscription
          </Button>
          <Button
            onClick={() => router.push("/dashboard/pricing")}
            className="bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl h-10 shadow-sm transition-all duration-200 hover:shadow-md"
          >
            Change Plan
          </Button>
        </div>
      </div>
    </div>
  );
}

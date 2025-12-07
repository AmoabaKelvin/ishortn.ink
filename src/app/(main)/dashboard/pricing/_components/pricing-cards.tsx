"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { DowngradeFeedbackModal } from "./downgrade-feedback-modal";

import type { Plan } from "@/lib/billing/plans";

type PricingCardsProps = {
  currentPlan: Plan;
};

const plans = [
  {
    id: "free" as Plan,
    name: "Free",
    description: "For personal use with basic features",
    price: 0,
    period: "forever",
    features: [
      "30 links per month",
      "1,000 tracked events",
      "7 days analytics history",
      "Basic link customization",
      "Standard support",
    ],
    limitations: [
      "No custom domains",
      "No folders",
      "Limited analytics",
    ],
  },
  {
    id: "pro" as Plan,
    name: "Pro",
    description: "For creators and small businesses",
    price: 5,
    period: "per month",
    popular: true,
    features: [
      "1,000 links per month",
      "10,000 tracked events",
      "Unlimited analytics history",
      "3 custom domains",
      "5 folders",
      "Priority support",
      "API access",
    ],
  },
  {
    id: "ultra" as Plan,
    name: "Ultra",
    description: "For teams and power users",
    price: 15,
    period: "per month",
    features: [
      "Unlimited links",
      "Unlimited tracked events",
      "Unlimited custom domains",
      "Unlimited folders",
      "Dedicated support",
      "Full API access",
      "Advanced analytics",
    ],
    comingSoon: [
      "Team collaboration",
      "Customization of password protected pages",
      "Device targeting",
      "Geo targeting",
      "Time-based routing",
      "UTM & Conversion tracking",
    ],
  },
];

export function PricingCards({ currentPlan }: PricingCardsProps) {
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const [targetDowngradePlan, setTargetDowngradePlan] = useState<Exclude<
    Plan,
    "ultra"
  > | null>(null);

  const createCheckoutOrUpdateMutation = api.lemonsqueezy.createCheckoutOrUpdate.useMutation({
    onSuccess: (data) => {
      if (data.status === "redirect" && data.url) {
        window.location.href = data.url;
      } else if (data.status === "updated") {
        toast.success(data.message);
        window.location.reload();
      }
      setLoadingPlan(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setLoadingPlan(null);
    },
  });

  const getSubscriptionDetails = api.lemonsqueezy.subscriptionDetails.useMutation({
    onSuccess: (urls) => {
      if (urls.customer_portal) {
        window.location.href = urls.customer_portal;
      } else if (urls.update_payment_method) {
        window.location.href = urls.update_payment_method;
      }
      setLoadingPlan(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setLoadingPlan(null);
    },
  });

  const handleUpgrade = (plan: typeof plans[number]) => {
    if (plan.id === "free") return;
    setLoadingPlan(plan.id);
    createCheckoutOrUpdateMutation.mutate({ plan: plan.id });
  };

  const handleManageSubscription = (planId: Plan) => {
    setLoadingPlan(planId);
    getSubscriptionDetails.mutate();
  };

  const getPlanOrder = (plan: Plan) => {
    const order = { free: 0, pro: 1, ultra: 2 };
    return order[plan];
  };

  const handleDowngrade = (targetPlan: Plan) => {
    if (targetPlan === "ultra") return;
    setTargetDowngradePlan(targetPlan as Exclude<Plan, "ultra">);
    setDowngradeModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Simple, transparent pricing
        </h2>
        <p className="mt-3 text-gray-500 dark:text-gray-400">
          Choose the plan that fits your needs. Upgrade or downgrade at any time.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlan;
          const canUpgrade = getPlanOrder(plan.id) > getPlanOrder(currentPlan);
          const canDowngrade = getPlanOrder(plan.id) < getPlanOrder(currentPlan);

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white dark:bg-gray-950 p-6 shadow-sm transition-shadow hover:shadow-md",
                plan.popular && currentPlan === "free" && "border-gray-900 dark:border-gray-100 ring-1 ring-gray-900 dark:ring-gray-100",
                isCurrentPlan && "border-blue-500 ring-1 ring-blue-500"
              )}
            >
              {/* Popular Badge */}
              {plan.popular && !isCurrentPlan && currentPlan === "free" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 px-3 py-1">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Popular
                  </Badge>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white px-3 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-sm font-medium text-gray-500">$</span>
                  <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
                    {plan.price}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {plan.period}
                </p>
              </div>

              {/* CTA Button */}
              <div className="mb-6">
                {isCurrentPlan ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleManageSubscription(plan.id)}
                    disabled={loadingPlan !== null || currentPlan === "free"}
                  >
                    {loadingPlan === plan.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {currentPlan === "free" ? "Current Plan" : "Manage Subscription"}
                  </Button>
                ) : canUpgrade ? (
                  <Button
                    className={cn(
                      "w-full",
                      plan.popular
                        ? "bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900"
                        : ""
                    )}
                    onClick={() => handleUpgrade(plan)}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === plan.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Upgrade to {plan.name}
                  </Button>
                ) : canDowngrade ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleDowngrade(plan.id)}
                    disabled={loadingPlan !== null}
                  >
                    Downgrade
                  </Button>
                ) : null}
              </div>



              {/* Features */}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-50 mb-4">
                  {plan.id === "free" ? "Features" : `Everything in ${plan.id === "pro" ? "Free" : "Pro"}, plus:`}
                </p>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-gray-600 dark:text-gray-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {plan.comingSoon && plan.comingSoon.length > 0 && (
                  <>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-200 dark:border-gray-800" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white dark:bg-gray-950 px-2 text-gray-500">
                          Coming Soon
                        </span>
                      </div>
                    </div>
                    <ul className="space-y-3">
                      {plan.comingSoon.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <Check className="h-4 w-4 text-gray-400 dark:text-gray-600 mt-0.5 shrink-0" />
                          <span className="text-sm text-gray-500 dark:text-gray-500">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Limitations for free plan */}
                {plan.limitations && (
                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs font-medium text-gray-500 mb-2">Limitations:</p>
                    <ul className="space-y-1">
                      {plan.limitations.map((limitation) => (
                        <li key={limitation} className="text-xs text-gray-400">
                          • {limitation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {targetDowngradePlan && (
        <DowngradeFeedbackModal
          open={downgradeModalOpen}
          onOpenChange={setDowngradeModalOpen}
          targetPlan={targetDowngradePlan}
          currentPlanName={
            plans.find((p) => p.id === currentPlan)?.name ?? currentPlan
          }
          targetPlanName={
            plans.find((p) => p.id === targetDowngradePlan)?.name ??
            targetDowngradePlan
          }
        />
      )}
    </div>
  );
}

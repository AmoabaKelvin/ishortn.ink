"use client";

import { Check, Loader2, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { PLAN_FEATURES } from "@/lib/billing/plan-features";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { DowngradeFeedbackModal } from "./downgrade-feedback-modal";
import {
  buildPlanChangeCopy,
  PlanChangeConfirmDialog,
} from "./plan-change-confirm-dialog";

import type { BillingInterval, Plan } from "@/lib/billing/plans";

type PricingCardsProps = {
  currentPlan: Plan;
  currentInterval: BillingInterval;
};

const plans = [
  {
    id: "free" as Plan,
    name: "Free",
    description: "For personal use with basic features",
    monthlyPrice: PLAN_PRICES_USD.free,
    annualPrice: PLAN_PRICES_USD.free,
    features: PLAN_FEATURES.free.features,
    limitations: ["No custom domains", "No folders", "Limited analytics"],
  },
  {
    id: "pro" as Plan,
    name: "Pro",
    description: "For creators and small businesses",
    monthlyPrice: PLAN_PRICES_USD.pro,
    annualPrice: PLAN_PRICES_ANNUAL_USD.pro,
    popular: true,
    features: PLAN_FEATURES.pro.features,
  },
  {
    id: "ultra" as Plan,
    name: "Ultra",
    description: "For teams and power users",
    monthlyPrice: PLAN_PRICES_USD.ultra,
    annualPrice: PLAN_PRICES_ANNUAL_USD.ultra,
    features: PLAN_FEATURES.ultra.features,
    comingSoon: PLAN_FEATURES.ultra.comingSoon,
  },
];

export function PricingCards({ currentPlan, currentInterval }: PricingCardsProps) {
  const searchParams = useSearchParams();
  const autoCheckoutFired = useRef(false);
  const [interval, setIntervalState] = useState<BillingInterval>(
    searchParams?.get("interval") === "annual" ? "annual" : "monthly",
  );
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const [targetDowngradePlan, setTargetDowngradePlan] = useState<Exclude<Plan, "ultra"> | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    plan: (typeof plans)[number];
    kind: "switch" | "upgrade";
  } | null>(null);

  const createCheckoutOrUpdateMutation = api.lemonsqueezy.createCheckoutOrUpdate.useMutation({
    onSuccess: (data) => {
      if (data.status === "redirect" && data.url) {
        window.location.href = data.url;
      } else if (data.status === "updated") {
        trackEvent(POSTHOG_EVENTS.SUBSCRIPTION_UPGRADED, {
          from_plan: currentPlan,
          to_plan: loadingPlan,
        });
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

  const runUpgrade = (plan: (typeof plans)[number]) => {
    if (plan.id === "free") return;
    setLoadingPlan(plan.id);
    createCheckoutOrUpdateMutation.mutate({
      plan: plan.id as Exclude<Plan, "free">,
      interval,
    });
  };

  const requestUpgrade = (plan: (typeof plans)[number], kind: "switch" | "upgrade") => {
    if (plan.id === "free") return;
    // Free → paid goes through the Lemon Squeezy hosted checkout (its own
    // confirmation). In-place changes for an existing paid subscriber charge
    // the card immediately, so confirm those first.
    if (currentPlan === "free") {
      runUpgrade(plan);
      return;
    }
    setPendingChange({ plan, kind });
    setConfirmOpen(true);
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

  // Auto-start checkout when arriving with ?plan=pro|ultra (e.g. right after signup).
  useEffect(() => {
    if (autoCheckoutFired.current) return;

    const requestedPlan = searchParams?.get("plan");
    if (requestedPlan !== "pro" && requestedPlan !== "ultra") return;

    const targetPlan = plans.find((p) => p.id === requestedPlan);
    if (!targetPlan) return;

    const canUpgrade = getPlanOrder(targetPlan.id) > getPlanOrder(currentPlan);
    if (!canUpgrade) return;

    autoCheckoutFired.current = true;
    requestUpgrade(targetPlan, "upgrade");
  }, [searchParams, currentPlan]);

  const confirmCopy = pendingChange
    ? buildPlanChangeCopy(
        pendingChange.kind,
        pendingChange.plan.id as Exclude<Plan, "free">,
        interval,
      )
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-foreground">
          Simple, transparent pricing
        </h2>
        <p className="mt-3 text-gray-500 dark:text-neutral-400">
          Choose the plan that fits your needs. Upgrade or downgrade at any time.
        </p>
      </div>

      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-border bg-white dark:bg-card p-1">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setIntervalState(value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                interval === value
                  ? "bg-gray-900 text-white dark:bg-muted dark:text-foreground"
                  : "text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-foreground",
              )}
            >
              {value === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
        <Badge className="bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-100">
          Save 2 months
        </Badge>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlan;
          const canUpgrade = getPlanOrder(plan.id) > getPlanOrder(currentPlan);
          const canDowngrade = getPlanOrder(plan.id) < getPlanOrder(currentPlan);
          // Same tier, but the toggle points at the other billing interval —
          // offer a switch instead of "Manage Subscription".
          const canSwitchInterval =
            isCurrentPlan && plan.id !== "free" && interval !== currentInterval;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white dark:bg-card p-6 shadow-sm transition-shadow hover:shadow-md",
                plan.popular &&
                  currentPlan === "free" &&
                  "border-gray-900 dark:border-border ring-1 ring-gray-900 dark:ring-border",
                isCurrentPlan && "border-blue-500 ring-1 ring-blue-500",
              )}
            >
              {/* Popular Badge */}
              {plan.popular && !isCurrentPlan && currentPlan === "free" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gray-900 text-white dark:bg-muted dark:text-foreground px-3 py-1">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Popular
                  </Badge>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-600 text-white px-3 py-1">Current Plan</Badge>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground">
                  {plan.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-sm font-medium text-gray-500 dark:text-neutral-400">$</span>
                  <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-foreground">
                    {interval === "annual" ? plan.annualPrice : plan.monthlyPrice}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                  {plan.id === "free"
                    ? "forever"
                    : interval === "annual"
                      ? "per year"
                      : "per month"}
                </p>
              </div>

              {/* CTA Button */}
              <div className="mb-6">
                {canSwitchInterval ? (
                  <Button
                    className="w-full"
                    onClick={() => requestUpgrade(plan, "switch")}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === plan.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Switch to {interval === "annual" ? "annual" : "monthly"} billing
                  </Button>
                ) : isCurrentPlan ? (
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
                        ? "bg-gray-900 hover:bg-gray-800 dark:bg-muted dark:hover:bg-accent dark:text-foreground"
                        : "",
                    )}
                    onClick={() => requestUpgrade(plan, "upgrade")}
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
                <p className="text-sm font-medium text-gray-900 dark:text-foreground mb-4">
                  {plan.id === "free"
                    ? "Features"
                    : `Everything in ${plan.id === "pro" ? "Free" : "Pro"}, plus:`}
                </p>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-gray-600 dark:text-neutral-400 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-neutral-400">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.comingSoon && plan.comingSoon.length > 0 && (
                  <>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-200 dark:border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white dark:bg-card px-2 text-gray-500 dark:text-neutral-400">
                          Coming Soon
                        </span>
                      </div>
                    </div>
                    <ul className="space-y-3">
                      {plan.comingSoon.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <Check className="h-4 w-4 text-gray-400 dark:text-neutral-500 mt-0.5 shrink-0" />
                          <span className="text-sm text-gray-500 dark:text-neutral-400">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* Limitations for free plan */}
                {plan.limitations && (
                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-border/50">
                    <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-2">
                      Limitations:
                    </p>
                    <ul className="space-y-1">
                      {plan.limitations.map((limitation) => (
                        <li
                          key={limitation}
                          className="text-xs text-gray-400 dark:text-neutral-500"
                        >
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
          currentPlanName={plans.find((p) => p.id === currentPlan)?.name ?? currentPlan}
          targetPlanName={
            plans.find((p) => p.id === targetDowngradePlan)?.name ?? targetDowngradePlan
          }
        />
      )}

      {pendingChange && confirmCopy && (
        <PlanChangeConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmCopy.title}
          description={confirmCopy.description}
          note={confirmCopy.note}
          confirmLabel={confirmCopy.confirmLabel}
          isLoading={createCheckoutOrUpdateMutation.isLoading}
          onConfirm={() => runUpgrade(pendingChange.plan)}
        />
      )}
    </div>
  );
}

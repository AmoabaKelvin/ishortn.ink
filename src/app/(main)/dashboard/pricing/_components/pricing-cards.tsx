"use client";

import { IconTag } from "@tabler/icons-react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { checkoutSource, readAttribution, utmTags } from "@/lib/billing/attribution";
import { PLAN_FEATURES } from "@/lib/billing/plan-features";
import { getPlanCaps } from "@/lib/billing/plans";
import { planPriceDisplay, resolveBillingInterval } from "@/lib/billing/pricing";
import { promoBannerText } from "@/lib/billing/promo";
import {
  checkoutReturnSearch,
  getUpgradeReason,
  resolveAutoUpgradePlan,
  resolveHighlightPlan,
} from "@/lib/billing/upgrade";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { ResumeSubscriptionButton } from "../../settings/billing/resume-subscription-button";
import { DowngradeFeedbackModal } from "./downgrade-feedback-modal";
import { buildPlanChangeCopy, PlanChangeConfirmDialog } from "./plan-change-confirm-dialog";

import type { BillingInterval, Plan, SubscriptionMode } from "@/lib/billing/plans";
import type { Promo } from "@/lib/billing/promo";
import type { ComponentProps } from "react";

type PricingCardsProps = {
  currentPlan: Plan;
  currentInterval: BillingInterval;
  subscriptionMode: SubscriptionMode;
  renewsAt: Date | null;
  /** Running promo, only passed when the next upgrade is a new checkout that gets the code. */
  promo: Promo | null;
  subscription: ComponentProps<typeof DowngradeFeedbackModal>["subscription"];
};

type PricingPlanSpec = {
  id: Plan;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: readonly string[];
  limitations?: readonly string[];
  popular?: boolean;
  comingSoon?: readonly string[];
};

const plans = [
  {
    id: "free",
    name: "Free",
    description: "For personal use with basic features",
    monthlyPrice: PLAN_PRICES_USD.free,
    annualPrice: PLAN_PRICES_USD.free,
    features: PLAN_FEATURES.free.features,
    limitations: ["No custom domains", "No folders", "Limited analytics"],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For creators and small businesses",
    monthlyPrice: PLAN_PRICES_USD.pro,
    annualPrice: PLAN_PRICES_ANNUAL_USD.pro,
    popular: true,
    features: PLAN_FEATURES.pro.features,
  },
  {
    id: "ultra",
    name: "Ultra",
    description: "For teams and power users",
    monthlyPrice: PLAN_PRICES_USD.ultra,
    annualPrice: PLAN_PRICES_ANNUAL_USD.ultra,
    features: PLAN_FEATURES.ultra.features,
    comingSoon: PLAN_FEATURES.ultra.comingSoon,
  },
] satisfies PricingPlanSpec[];

type PricingPlan = (typeof plans)[number];
type PaidPricingPlan = Exclude<PricingPlan, { id: "free" }>;
type PendingChange = { plan: PaidPricingPlan; kind: "switch" | "upgrade" };

const PLAN_ORDER = { free: 0, pro: 1, ultra: 2 } satisfies Record<Plan, number>;

const paidPlans = plans.filter((plan): plan is PaidPricingPlan => plan.id !== "free");

// Back from the hosted checkout returns to the current history entry. Rewriting it in place means
// the ?plan= sign-up entry can't start another checkout on Back.
function replaceWithCheckoutReturn(plan: PaidPricingPlan["id"]) {
  window.history.replaceState(null, "", checkoutReturnSearch(window.location.search, plan));
}

const PRO_EVENTS_LIMIT = getPlanCaps("pro").eventsLimit ?? 0;

export function PricingCards({
  currentPlan,
  currentInterval,
  subscriptionMode,
  renewsAt,
  promo,
  subscription,
}: PricingCardsProps) {
  const searchParams = useSearchParams();
  const [interval, setIntervalState] = useState<BillingInterval>(
    resolveBillingInterval(searchParams?.get("interval"), currentPlan, currentInterval),
  );
  const [priceFade, setPriceFade] = useState(false);
  // Arriving with ?plan=pro|ultra (e.g. right after signup) starts that upgrade
  // right away: hosted checkout for free users, the confirm dialog otherwise.
  const [autoUpgrade] = useState(() => {
    const planId = resolveAutoUpgradePlan(searchParams, currentPlan, subscriptionMode);
    return paidPlans.find((p) => p.id === planId) ?? null;
  });
  // Arriving from an in-app upgrade prompt (?highlight=pro|ultra&source=…)
  // only preselects the plan that removes the limit; it never starts checkout.
  const highlightPlan = resolveHighlightPlan(searchParams?.get("highlight"), currentPlan);
  const source = searchParams?.get("source") ?? null;
  // Source and UTM tags carried from /pricing through sign-up, read once on arrival and sent with
  // the checkout.
  const [attribution] = useState(() => readAttribution(searchParams));
  const [utm] = useState(() => utmTags(attribution));
  const highlightReason = highlightPlan ? getUpgradeReason(source, highlightPlan) : null;
  const fromEventsCap = source?.startsWith("events_") ?? false;
  const autoCheckout = autoUpgrade && subscriptionMode === "checkout" ? autoUpgrade : null;
  const autoCheckoutFired = useRef(false);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(autoCheckout?.id ?? null);
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const [targetDowngradePlan, setTargetDowngradePlan] = useState<Exclude<Plan, "ultra"> | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(autoUpgrade !== null && autoCheckout === null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(
    autoUpgrade && autoCheckout === null ? { plan: autoUpgrade, kind: "upgrade" } : null,
  );

  const createCheckoutOrUpdateMutation = api.lemonsqueezy.createCheckoutOrUpdate.useMutation({
    onSuccess: (data, variables) => {
      if (data.status === "redirect") {
        replaceWithCheckoutReturn(variables.plan);
        window.location.assign(data.url);
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

  const runUpgrade = (plan: PaidPricingPlan) => {
    setLoadingPlan(plan.id);
    createCheckoutOrUpdateMutation.mutate({
      plan: plan.id,
      interval,
      source: checkoutSource(attribution),
      utm,
    });
  };

  const requestUpgrade = (plan: PricingPlan, kind: "switch" | "upgrade") => {
    if (plan.id === "free") return;
    // Free → paid goes through the Lemon Squeezy hosted checkout (its own
    // confirmation). In-place changes for an existing paid subscriber charge
    // the card immediately, so confirm those first.
    if (subscriptionMode === "checkout") {
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

  const handleDowngrade = (targetPlan: Plan) => {
    if (targetPlan === "ultra") return;
    setTargetDowngradePlan(targetPlan);
    setDowngradeModalOpen(true);
  };

  const { mutate: createCheckoutOrUpdate } = createCheckoutOrUpdateMutation;
  useEffect(() => {
    if (!autoCheckout || autoCheckoutFired.current) return;
    autoCheckoutFired.current = true;
    replaceWithCheckoutReturn(autoCheckout.id);
    createCheckoutOrUpdate({
      plan: autoCheckout.id,
      interval,
      source: checkoutSource(attribution, "auto_signup"),
      utm,
    });
  }, [attribution, autoCheckout, createCheckoutOrUpdate, interval, utm]);

  const confirmCopy = pendingChange
    ? buildPlanChangeCopy(pendingChange.kind, pendingChange.plan.id, interval)
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
        {highlightReason && (
          <p className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400">
            {highlightReason}
          </p>
        )}
      </div>

      {/* Billing interval toggle */}
      <div className="flex items-center justify-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-border bg-white dark:bg-card p-1">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => {
                setIntervalState(value);
                setPriceFade(true);
              }}
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
          2 months free
        </Badge>
      </div>

      {fromEventsCap && (
        <p className="mx-auto max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[13px] text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
          Pro records {PRO_EVENTS_LIMIT.toLocaleString()} visits a month; Ultra has no limit. Visits
          from before the upgrade are not recovered.
        </p>
      )}

      {promo && (
        <p className="mx-auto flex max-w-2xl items-start gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-[13px] text-neutral-700 dark:border-border dark:bg-card dark:text-neutral-300 sm:items-center sm:justify-center">
          <IconTag
            size={16}
            stroke={1.5}
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400 sm:mt-0"
          />
          <span className="min-w-0">{promoBannerText(promo)}</span>
        </p>
      )}

      {/* Pricing Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlan;
          // A cancelled subscription still in its paid period is resumed, not
          // replaced or changed, so it only offers Resume on the current plan.
          const isResumable = subscriptionMode === "resume";
          const canChangeInPlace = subscriptionMode === "update";
          const canUpgrade = !isResumable && PLAN_ORDER[plan.id] > PLAN_ORDER[currentPlan];
          const canDowngrade = canChangeInPlace && PLAN_ORDER[plan.id] < PLAN_ORDER[currentPlan];
          // Same tier, but the toggle points at the other billing interval —
          // offer a switch instead of "Manage Subscription".
          const canSwitchInterval =
            canChangeInPlace && isCurrentPlan && plan.id !== "free" && interval !== currentInterval;
          // The highlighted plan takes over the "Popular" treatment so only one card stands out.
          const isHighlighted = plan.id === highlightPlan;
          const isEmphasized = highlightPlan
            ? isHighlighted
            : "popular" in plan && plan.popular && currentPlan === "free";
          const price = planPriceDisplay(plan.id, interval, promo);

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white dark:bg-card p-6 shadow-sm transition-shadow hover:shadow-md",
                isEmphasized &&
                  !isCurrentPlan &&
                  "border-gray-900 dark:border-border ring-1 ring-gray-900 dark:ring-border",
                isCurrentPlan && "border-blue-500 ring-1 ring-blue-500",
              )}
            >
              {/* Popular / highlighted Badge */}
              {isEmphasized && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="whitespace-nowrap bg-gray-900 text-white dark:bg-muted dark:text-foreground px-3 py-1">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {isHighlighted ? "Removes this limit" : "Popular"}
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
              {/* Keyed on the figure so a toggle fades the new price in; always two lines so the
                  buttons stay aligned across cards on both intervals. */}
              <div
                key={`${price.perMonth}-${price.note}`}
                className={cn(
                  "mb-6",
                  priceFade &&
                    "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 motion-safe:ease-out",
                )}
              >
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  {price.compareAt && (
                    <del className="mr-1 text-lg tabular-nums text-gray-400 dark:text-muted-foreground">
                      <span className="sr-only">Regular price </span>${price.compareAt}
                    </del>
                  )}
                  <span className="text-5xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-foreground">
                    ${price.perMonth}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-neutral-400">/mo</span>
                </div>
                <p className="mt-1 text-sm tabular-nums text-gray-500 dark:text-neutral-400">
                  {price.note}
                </p>
              </div>

              {/* CTA Button */}
              <div className="mb-6">
                {isCurrentPlan && isResumable ? (
                  <ResumeSubscriptionButton className="w-full" />
                ) : canSwitchInterval ? (
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
                      isEmphasized
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
                {fromEventsCap && canUpgrade && isEmphasized && (
                  <p className="mt-2 text-center text-xs tabular-nums text-gray-500 dark:text-neutral-400">
                    ${plan.monthlyPrice}/month or ${plan.annualPrice}/year
                  </p>
                )}
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
                          <Check className="h-4 w-4 text-gray-400 dark:text-muted-foreground mt-0.5 shrink-0" />
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
                          className="text-xs text-gray-400 dark:text-muted-foreground"
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
          renewsAt={renewsAt}
          subscription={subscription}
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

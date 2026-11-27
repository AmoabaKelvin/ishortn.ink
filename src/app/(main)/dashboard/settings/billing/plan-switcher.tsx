"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { scheduledPause } from "@/lib/billing/plans";
import { planPriceDisplay, resolveBillingInterval } from "@/lib/billing/pricing";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { DowngradeFeedbackModal } from "../../pricing/_components/downgrade-feedback-modal";
import { PlanChangeConfirmDialog } from "../../pricing/_components/plan-change-confirm-dialog";

import type { BillingInterval, Plan, SubscriptionMode } from "@/lib/billing/plans";
import type { PlanPriceDisplay } from "@/lib/billing/pricing";
import type { Promo } from "@/lib/billing/promo";
import type { ComponentProps } from "react";

const PLANS: { id: Plan; name: string }[] = [
  { id: "free", name: "Free" },
  { id: "pro", name: "Pro" },
  { id: "ultra", name: "Ultra" },
];

const planOrder = { free: 0, pro: 1, ultra: 2 } satisfies Record<Plan, number>;

type PlanSwitcherProps = {
  currentPlan: Plan;
  currentInterval: BillingInterval;
  subscriptionMode: SubscriptionMode;
  renewsAt: Date | null;
  /** Running promo, only passed when the next upgrade is a new checkout that gets the code. */
  promo: Promo | null;
  /** What the subscriber is billed for their current plan and interval, discount included. */
  currentPrice: PlanPriceDisplay | null;
  subscription: ComponentProps<typeof DowngradeFeedbackModal>["subscription"];
  /** Set while the subscription is paused; it has to be resumed before changing plans. */
  isPaused: boolean;
};

export function PlanSwitcher({
  currentPlan,
  currentInterval,
  subscriptionMode,
  renewsAt,
  promo,
  currentPrice,
  subscription,
  isPaused,
}: PlanSwitcherProps) {
  const [interval, setIntervalState] = useState<BillingInterval>(() =>
    resolveBillingInterval(null, currentPlan, currentInterval),
  );
  const [priceFade, setPriceFade] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [targetDowngrade, setTargetDowngrade] = useState<Exclude<Plan, "ultra"> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    plan: Exclude<Plan, "free">;
    kind: "switch" | "upgrade";
  } | null>(null);

  const createCheckoutOrUpdate = api.lemonsqueezy.createCheckoutOrUpdate.useMutation({
    onSuccess: (data) => {
      if (data.status === "redirect") {
        window.location.assign(data.url);
        return;
      }
      if (data.status === "updated") {
        trackEvent(POSTHOG_EVENTS.SUBSCRIPTION_UPGRADED, {
          from_plan: currentPlan,
          to_plan: loadingPlan,
        });
        toast.success(data.message);
        window.location.reload();
        return;
      }
      setLoadingPlan(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setLoadingPlan(null);
    },
  });

  // Back from the hosted checkout can restore this page from the bfcache with the spinner still on.
  useEffect(() => {
    const resetOnRestore = (event: PageTransitionEvent) => {
      if (event.persisted) setLoadingPlan(null);
    };
    window.addEventListener("pageshow", resetOnRestore);
    return () => window.removeEventListener("pageshow", resetOnRestore);
  }, []);

  const runUpgrade = (plan: Exclude<Plan, "free">) => {
    setLoadingPlan(plan);
    createCheckoutOrUpdate.mutate({ plan, interval, source: "settings_billing" });
  };

  const requestUpgrade = (plan: Plan, kind: "switch" | "upgrade") => {
    if (plan === "free") return;
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

  const handleDowngrade = (plan: Plan) => {
    if (plan === "ultra") return;
    setTargetDowngrade(plan);
    setDowngradeOpen(true);
  };

  const canChangeInPlace = subscriptionMode === "update";
  const isResumable = subscriptionMode === "resume";
  const pause = scheduledPause(subscription);
  const currentPlanName = PLANS.find((p) => p.id === currentPlan)?.name ?? currentPlan;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground">Change plan</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            2 months free
          </span>
          <div className="inline-flex items-center gap-0.5 rounded-full border border-neutral-200 dark:border-border p-0.5">
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
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  interval === value
                    ? "bg-neutral-900 text-white dark:bg-muted dark:text-foreground"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-foreground",
                )}
              >
                {value === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isResumable && (
        <p className="mt-2 text-[12px] text-neutral-500 dark:text-neutral-400">
          {pause
            ? // The status line above already shows the pause dates.
              "Resume it now to change plans."
            : `Your subscription is ${isPaused ? "paused" : "cancelled"}. Resume it to change plans.`}
        </p>
      )}

      <div className="mt-3 divide-y divide-neutral-100 dark:divide-border/50 overflow-hidden rounded-lg border border-neutral-200 dark:border-border">
        {PLANS.map((plan) => {
          const isCurrentTier = plan.id === currentPlan;
          const matchesCurrent =
            isCurrentTier && (plan.id === "free" || interval === currentInterval);
          // Switching and downgrading change a live subscription in place; a
          // cancelled one has to be resumed first.
          const canSwitchInterval =
            canChangeInPlace && isCurrentTier && plan.id !== "free" && interval !== currentInterval;
          const isUpgrade = !isResumable && planOrder[plan.id] > planOrder[currentPlan];
          const isDowngrade = canChangeInPlace && planOrder[plan.id] < planOrder[currentPlan];

          const price =
            matchesCurrent && currentPrice
              ? currentPrice
              : planPriceDisplay(plan.id, interval, promo);

          return (
            <div
              key={plan.id}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3",
                isCurrentTier && "bg-neutral-50/70 dark:bg-muted/20",
              )}
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground">
                  {plan.name}
                </p>
                <p
                  key={price.note}
                  className={cn(
                    "text-[12px] tabular-nums text-neutral-400 dark:text-muted-foreground",
                    priceFade &&
                      "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150 motion-safe:ease-out",
                  )}
                >
                  {plan.id === "free" ? (
                    "Free forever"
                  ) : (
                    <>
                      {price.compareAt && (
                        <del className="mr-1">
                          <span className="sr-only">Regular price </span>${price.compareAt}
                        </del>
                      )}
                      ${price.perMonth}/mo &middot; {price.note}
                    </>
                  )}
                </p>
              </div>

              {matchesCurrent ? (
                <span className="shrink-0 rounded-full border border-neutral-200 dark:border-border px-2.5 py-1 text-[11px] font-medium text-neutral-400 dark:text-muted-foreground">
                  Current
                </span>
              ) : canSwitchInterval ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 text-[12px]"
                  onClick={() => requestUpgrade(plan.id, "switch")}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === plan.id && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Switch to {interval === "annual" ? "annual" : "monthly"}
                </Button>
              ) : isUpgrade ? (
                <Button
                  size="sm"
                  className="h-8 shrink-0 bg-blue-600 text-[12px] text-white hover:bg-blue-700"
                  onClick={() => requestUpgrade(plan.id, "upgrade")}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === plan.id && (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  )}
                  Upgrade
                </Button>
              ) : isDowngrade ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 text-[12px]"
                  onClick={() => handleDowngrade(plan.id)}
                  disabled={loadingPlan !== null}
                >
                  {plan.id === "free" ? "Cancel plan" : "Downgrade"}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {targetDowngrade && (
        <DowngradeFeedbackModal
          open={downgradeOpen}
          onOpenChange={setDowngradeOpen}
          targetPlan={targetDowngrade}
          currentPlanName={currentPlanName}
          renewsAt={renewsAt}
          subscription={subscription}
          targetPlanName={PLANS.find((p) => p.id === targetDowngrade)?.name ?? targetDowngrade}
        />
      )}

      {pendingChange && (
        <PlanChangeConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          kind={pendingChange.kind}
          targetPlan={pendingChange.plan}
          interval={interval}
          isLoading={createCheckoutOrUpdate.isLoading}
          onConfirm={() => runUpgrade(pendingChange.plan)}
        />
      )}
    </div>
  );
}

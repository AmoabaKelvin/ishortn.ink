"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { DowngradeFeedbackModal } from "../../pricing/_components/downgrade-feedback-modal";
import {
  buildPlanChangeCopy,
  PlanChangeConfirmDialog,
} from "../../pricing/_components/plan-change-confirm-dialog";

import type { BillingInterval, Plan } from "@/lib/billing/plans";

const PLANS: { id: Plan; name: string; monthly: number; annual: number }[] = [
  { id: "free", name: "Free", monthly: PLAN_PRICES_USD.free, annual: 0 },
  { id: "pro", name: "Pro", monthly: PLAN_PRICES_USD.pro, annual: PLAN_PRICES_ANNUAL_USD.pro },
  { id: "ultra", name: "Ultra", monthly: PLAN_PRICES_USD.ultra, annual: PLAN_PRICES_ANNUAL_USD.ultra },
];

const planOrder: Record<Plan, number> = { free: 0, pro: 1, ultra: 2 };

type PlanSwitcherProps = {
  currentPlan: Plan;
  currentInterval: BillingInterval;
};

export function PlanSwitcher({ currentPlan, currentInterval }: PlanSwitcherProps) {
  const [interval, setIntervalState] = useState<BillingInterval>(currentInterval);
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
      if (data.status === "redirect" && data.url) {
        window.location.href = data.url;
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

  const runUpgrade = (plan: Exclude<Plan, "free">) => {
    setLoadingPlan(plan);
    createCheckoutOrUpdate.mutate({ plan, interval });
  };

  const requestUpgrade = (plan: Plan, kind: "switch" | "upgrade") => {
    if (plan === "free") return;
    const target = plan as Exclude<Plan, "free">;
    // Free → paid goes through the Lemon Squeezy hosted checkout (its own
    // confirmation). In-place changes for an existing paid subscriber charge
    // the card immediately, so confirm those first.
    if (currentPlan === "free") {
      runUpgrade(target);
      return;
    }
    setPendingChange({ plan: target, kind });
    setConfirmOpen(true);
  };

  const handleDowngrade = (plan: Plan) => {
    if (plan === "ultra") return;
    setTargetDowngrade(plan as Exclude<Plan, "ultra">);
    setDowngradeOpen(true);
  };

  const currentPlanName = PLANS.find((p) => p.id === currentPlan)?.name ?? currentPlan;
  const confirmCopy = pendingChange
    ? buildPlanChangeCopy(pendingChange.kind, pendingChange.plan, interval)
    : null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-neutral-900 dark:text-foreground">Change plan</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Save 2 months
          </span>
          <div className="inline-flex items-center gap-0.5 rounded-full border border-neutral-200 dark:border-border p-0.5">
            {(["monthly", "annual"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setIntervalState(value)}
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

      <div className="mt-3 divide-y divide-neutral-100 dark:divide-border/50 overflow-hidden rounded-lg border border-neutral-200 dark:border-border">
        {PLANS.map((plan) => {
          const isCurrentTier = plan.id === currentPlan;
          const matchesCurrent =
            isCurrentTier && (plan.id === "free" || interval === currentInterval);
          const canSwitchInterval =
            isCurrentTier && plan.id !== "free" && interval !== currentInterval;
          const isUpgrade = planOrder[plan.id] > planOrder[currentPlan];
          const isDowngrade = planOrder[plan.id] < planOrder[currentPlan];

          const priceLabel =
            plan.id === "free"
              ? "Free forever"
              : interval === "annual"
                ? `$${plan.annual}/yr`
                : `$${plan.monthly}/mo`;

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
                <p className="text-[12px] text-neutral-400 dark:text-neutral-500">{priceLabel}</p>
              </div>

              {matchesCurrent ? (
                <span className="shrink-0 rounded-full border border-neutral-200 dark:border-border px-2.5 py-1 text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
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
          targetPlanName={PLANS.find((p) => p.id === targetDowngrade)?.name ?? targetDowngrade}
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
          isLoading={createCheckoutOrUpdate.isLoading}
          onConfirm={() => runUpgrade(pendingChange.plan)}
        />
      )}
    </div>
  );
}

"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { subscribedPlan } from "@/lib/billing/entitlements";
import { PLAN_CAPS, subscriptionInterval } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import { DowngradeFeedbackModal } from "../../pricing/_components/downgrade-feedback-modal";
import { PlanSwitcher } from "./plan-switcher";
import { ResumeSubscriptionButton } from "./resume-subscription-button";

import type { Promo } from "@/lib/billing/promo";
import type { RouterOutputs } from "@/trpc/shared";

type BillingProps = {
  subscriptions: RouterOutputs["subscriptions"]["get"];
  /** Running promo, only passed when the next upgrade is a new checkout that gets the code. */
  promo: Promo | null;
};

type SubscriptionRow = NonNullable<RouterOutputs["subscriptions"]["get"]["subscriptions"]>;
type Tone = "success" | "warning" | "neutral";

const TONE_CLASSES = {
  success: { text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  warning: { text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  neutral: { text: "text-neutral-500 dark:text-neutral-400", dot: "bg-neutral-400" },
} satisfies Record<Tone, { text: string; dot: string }>;

const formatDate = (date: Date | string) => format(new Date(date), "MMM d, yyyy");

type StatusDisplay = {
  label: string;
  tone: Tone;
  detail: string | null;
};

function getStatusDisplay(subscription: SubscriptionRow): StatusDisplay {
  const { status, renewsAt, endsAt, pausedUntil } = subscription;

  switch (status) {
    case "active":
      return {
        label: "Active",
        tone: "success",
        detail: renewsAt ? `Renews ${formatDate(renewsAt)}` : null,
      };
    case "on_trial":
      return {
        label: "Trial",
        tone: "neutral",
        detail: renewsAt ? `Trial ends ${formatDate(renewsAt)}` : null,
      };
    case "past_due":
      return {
        label: "Past due",
        tone: "warning",
        detail: null,
      };
    case "paused":
      return {
        label: "Paused",
        tone: "neutral",
        detail: pausedUntil ? `Billing restarts ${formatDate(pausedUntil)}` : null,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        tone: "neutral",
        detail: endsAt ? `Access until ${formatDate(endsAt)}` : null,
      };
    default:
      return {
        label: status ? status.replace(/_/g, " ") : "Unknown",
        tone: "neutral",
        detail: null,
      };
  }
}

const proLinksLimit = PLAN_CAPS.pro.linksLimit?.toLocaleString() ?? "more";

export default function Billing({ subscriptions, promo }: BillingProps) {
  const [loadingTarget, setLoadingTarget] = useState<"portal" | "payment" | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const subscription = subscriptions?.subscriptions;
  const subscriptionMode = subscriptions?.subscriptionMode ?? "checkout";
  // A paused subscription has Free access but still holds its plan until billing restarts.
  const isPaused = subscriptionMode === "resume" && subscription?.status === "paused";
  const currentPlan = isPaused ? subscribedPlan(subscription) : (subscriptions?.plan ?? "free");
  const currentInterval = subscriptionInterval(subscription);
  // A row that resolves to Free (expired, or never paid) has no live status worth showing.
  const isPaid = currentPlan !== "free";
  const statusDisplay = subscription && isPaid ? getStatusDisplay(subscription) : null;
  const isPastDue = isPaid && subscription?.status === "past_due";

  const getSubscriptionDetails = api.lemonsqueezy.subscriptionDetails.useMutation({
    onSuccess: (urls) => {
      const url =
        loadingTarget === "payment"
          ? (urls.update_payment_method ?? urls.customer_portal)
          : (urls.customer_portal ?? urls.update_payment_method);
      if (url) {
        window.location.href = url;
      } else {
        toast.error("Could not find subscription portal URL");
        setLoadingTarget(null);
      }
    },
    onError: (error) => {
      toast.error(error.message);
      setLoadingTarget(null);
    },
  });

  const openPortal = (target: "portal" | "payment") => {
    setLoadingTarget(target);
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
          {statusDisplay && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium",
                TONE_CLASSES[statusDisplay.tone].text,
              )}
            >
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  TONE_CLASSES[statusDisplay.tone].dot,
                )}
              />
              {statusDisplay.label}
            </span>
          )}
        </div>

        {statusDisplay && subscription ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
            {statusDisplay.detail && (
              <span className="text-neutral-400 dark:text-muted-foreground">
                {statusDisplay.detail}
              </span>
            )}
            {subscription.cardLastFour && (
              <>
                {statusDisplay.detail && (
                  <span className="text-neutral-300 dark:text-neutral-600">&middot;</span>
                )}
                <span className="capitalize text-neutral-500 dark:text-neutral-400">
                  {subscription.cardBrand} &bull;&bull;&bull;&bull; {subscription.cardLastFour}
                </span>
              </>
            )}
          </div>
        ) : (
          <p className="mt-1 text-[12px] text-neutral-400 dark:text-muted-foreground">
            Upgrade for up to {proLinksLimit} links a month, custom domains, and advanced analytics.
          </p>
        )}

        {isPastDue && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-amber-700 dark:text-amber-400">
              Your last payment failed. Update your payment method to keep your plan.
            </p>
            <button
              type="button"
              onClick={() => openPortal("payment")}
              disabled={loadingTarget !== null}
              className="inline-flex shrink-0 items-center text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-50"
            >
              {loadingTarget === "payment" && (
                <IconLoader2 size={14} stroke={1.5} className="mr-1 animate-spin" />
              )}
              Update payment method
            </button>
          </div>
        )}

        {subscription && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {subscriptionMode === "resume" && (
              <ResumeSubscriptionButton className="h-8 text-[12px]" />
            )}
            <Button
              onClick={() => openPortal("portal")}
              disabled={loadingTarget !== null}
              variant="outline"
              className="h-8 border-neutral-200 dark:border-border text-[12px]"
            >
              {loadingTarget === "portal" && (
                <IconLoader2 size={14} stroke={1.5} className="mr-1.5 animate-spin" />
              )}
              Invoices &amp; payment method
            </Button>
            {subscriptionMode === "update" && isPaid && (
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="ml-1 text-[12px] font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-foreground"
              >
                Cancel plan
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inline plan switcher */}
      <div className="border-t border-neutral-100 dark:border-border/50 pt-5">
        <PlanSwitcher
          currentPlan={currentPlan}
          currentInterval={currentInterval}
          subscriptionMode={subscriptionMode}
          renewsAt={subscription?.renewsAt ?? null}
          promo={promo}
          subscription={subscription ?? null}
          isPaused={isPaused}
        />
      </div>

      {subscriptionMode === "update" && isPaid && (
        <DowngradeFeedbackModal
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          targetPlan="free"
          currentPlanName={currentPlan === "ultra" ? "Ultra" : "Pro"}
          targetPlanName="Free"
          renewsAt={subscription?.renewsAt ?? null}
          subscription={subscription ?? null}
        />
      )}
    </div>
  );
}

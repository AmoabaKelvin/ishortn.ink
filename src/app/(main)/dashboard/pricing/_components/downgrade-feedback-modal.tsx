"use client";

import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import {
  canOfferPause,
  isLegacyProVariant,
  PAUSE_MONTH_OPTIONS,
  pauseResumesAt,
} from "@/lib/billing/plans";
import { formatUsd } from "@/lib/billing/pricing";
import { PLAN_PRICES_USD, PRO_LEGACY_MONTHLY_PRICE_USD } from "@/lib/constants/plan-pricing";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import type { Plan } from "@/lib/billing/plans";

const DOWNGRADE_REASONS = [
  { value: "too_expensive", label: "Too expensive for my needs" },
  { value: "not_using_features", label: "Not using the premium features" },
  {
    value: "switching_to_competitor",
    label: "Switching to a different service",
  },
  { value: "temporary_pause", label: "Taking a temporary break" },
  { value: "missing_features", label: "Missing features I need" },
  { value: "other", label: "Other reason" },
] as const;

type DowngradeFormData = {
  reason: (typeof DOWNGRADE_REASONS)[number]["value"];
  additionalFeedback?: string;
};

type DowngradeFeedbackModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan: Exclude<Plan, "ultra">;
  currentPlanName: string;
  targetPlanName: string;
  /** Next renewal date from the provider; a cancellation keeps access until then. */
  renewsAt: Date | null;
  /** The live subscription; decides whether cancelling first offers a pause (canOfferPause). */
  subscription: Parameters<typeof canOfferPause>[0];
};

export function DowngradeFeedbackModal({
  open,
  onOpenChange,
  targetPlan,
  currentPlanName,
  targetPlanName,
  renewsAt,
  subscription,
}: DowngradeFeedbackModalProps) {
  const renewalDate = renewsAt ? format(new Date(renewsAt), "MMM d, yyyy") : null;
  const offersPause = targetPlan === "free" && canOfferPause(subscription);
  const onLegacyPrice = isLegacyProVariant(subscription?.variantId);
  const [step, setStep] = useState<"reason" | "pause">("reason");
  const [pauseMonths, setPauseMonths] = useState<number>(PAUSE_MONTH_OPTIONS[0]);
  const {
    control,
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm<DowngradeFormData>();

  const close = () => {
    reset();
    setStep("reason");
    setPauseMonths(PAUSE_MONTH_OPTIONS[0]);
    onOpenChange(false);
  };

  const downgradeMutation = api.lemonsqueezy.downgradeWithFeedback.useMutation({
    onSuccess: (data) => {
      trackEvent(POSTHOG_EVENTS.SUBSCRIPTION_DOWNGRADED, {
        from_plan: currentPlanName.toLowerCase(),
        to_plan: targetPlan,
      });
      toast.success(data.message);
      close();
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to process downgrade");
    },
  });

  const pauseMutation = api.lemonsqueezy.pauseSubscription.useMutation({
    onSuccess: (data, variables) => {
      trackEvent(POSTHOG_EVENTS.SUBSCRIPTION_PAUSED, {
        months: variables.months,
        reason: variables.reason,
        legacy_price: onLegacyPrice,
      });
      toast.success(data.message);
      close();
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isBusy = downgradeMutation.isLoading || pauseMutation.isLoading;

  const cancel = (data: DowngradeFormData) => {
    downgradeMutation.mutate({
      targetPlan,
      reason: data.reason,
      additionalFeedback: data.additionalFeedback,
    });
  };

  const onSubmit = (data: DowngradeFormData) => {
    if (!offersPause) {
      cancel(data);
      return;
    }
    trackEvent(POSTHOG_EVENTS.CANCEL_OFFER_SHOWN, {
      offer: "pause",
      reason: data.reason,
      legacy_price: onLegacyPrice,
    });
    setStep("pause");
  };

  const pause = () => {
    const { reason, additionalFeedback } = getValues();
    pauseMutation.mutate({ months: pauseMonths, reason, feedback: additionalFeedback });
  };

  const restartDate = format(pauseResumesAt(pauseMonths), "MMM d, yyyy");

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-[480px]">
        {step === "pause" ? (
          <>
            <DialogHeader>
              <DialogTitle>Pause instead of cancelling?</DialogTitle>
              <DialogDescription>
                Billing stops for the months you choose and restarts on {restartDate}. Your links
                keep redirecting while paused; paid features follow Free plan limits until billing
                restarts.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              <fieldset className="space-y-1.5">
                <legend className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                  Pause for
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {PAUSE_MONTH_OPTIONS.map((months) => {
                    const selected = pauseMonths === months;
                    return (
                      <button
                        key={months}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setPauseMonths(months)}
                        disabled={isBusy}
                        className={cn(
                          "h-9 rounded-lg border text-[13px] font-medium tabular-nums transition-colors disabled:opacity-50",
                          selected
                            ? "border-blue-600 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-400"
                            : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-border dark:bg-card dark:text-neutral-300 dark:hover:bg-accent/50",
                        )}
                      >
                        {months} {months === 1 ? "month" : "months"}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {onLegacyPrice && (
                <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] text-neutral-700 dark:border-border dark:bg-accent/50 dark:text-neutral-300">
                  You&apos;re on the original ${formatUsd(PRO_LEGACY_MONTHLY_PRICE_USD)}/month Pro
                  price. Pausing keeps it; if you cancel, subscribing again costs $
                  {formatUsd(PLAN_PRICES_USD.pro)}/month.
                </p>
              )}
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => cancel(getValues())}
                disabled={isBusy}
                className="h-9"
              >
                {downgradeMutation.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Cancel anyway"
                )}
              </Button>
              <Button
                type="button"
                onClick={pause}
                disabled={isBusy}
                className="h-9 bg-blue-600 text-white hover:bg-blue-700"
              >
                {pauseMutation.isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Pausing...
                  </>
                ) : (
                  "Pause billing"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Downgrade to {targetPlanName}</DialogTitle>
              <DialogDescription>Before you go, we&apos;d love to know why.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)}>
              <DialogBody className="space-y-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="reason"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Reason for downgrading
                  </Label>
                  <Controller
                    name="reason"
                    control={control}
                    rules={{ required: "Please select a reason" }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger
                          className={`h-10 ${errors.reason ? "border-destructive" : ""}`}
                        >
                          <SelectValue placeholder="Select a reason..." />
                        </SelectTrigger>
                        <SelectContent>
                          {DOWNGRADE_REASONS.map((reason) => (
                            <SelectItem key={reason.value} value={reason.value}>
                              {reason.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.reason && (
                    <p className="text-xs text-destructive">{errors.reason.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="additionalFeedback"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    What could we improve?
                    <span className="ml-1.5 text-muted-foreground/60 lowercase tracking-normal font-normal">
                      optional
                    </span>
                  </Label>
                  <Textarea
                    id="additionalFeedback"
                    placeholder="Share any feedback..."
                    rows={3}
                    className="resize-none text-sm"
                    {...register("additionalFeedback", {
                      maxLength: {
                        value: 1000,
                        message: "Feedback is too long (max 1000 characters)",
                      },
                    })}
                  />
                  {errors.additionalFeedback && (
                    <p className="text-xs text-destructive">{errors.additionalFeedback.message}</p>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {targetPlan === "free"
                    ? `You'll keep ${currentPlanName} until ${renewalDate ?? "the end of your billing period"}, then move to ${targetPlanName}.`
                    : `You'll move to ${targetPlanName} right away. Credit for unused ${currentPlanName} time goes toward your next invoice${renewalDate ? ` on ${renewalDate}` : ""}.`}
                </p>
              </DialogBody>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={close}
                  disabled={downgradeMutation.isLoading}
                  className="h-9"
                >
                  Cancel
                </Button>
                {offersPause ? (
                  <Button type="submit" variant="outline" className="h-9">
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={downgradeMutation.isLoading}
                    className="h-9"
                  >
                    {downgradeMutation.isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Confirm"
                    )}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

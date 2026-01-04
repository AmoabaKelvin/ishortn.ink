"use client";

import { Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
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
};

export function DowngradeFeedbackModal({
  open,
  onOpenChange,
  targetPlan,
  currentPlanName,
  targetPlanName,
}: DowngradeFeedbackModalProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DowngradeFormData>();

  const downgradeMutation = api.lemonsqueezy.downgradeWithFeedback.useMutation({
    onSuccess: (data) => {
      trackEvent(POSTHOG_EVENTS.SUBSCRIPTION_DOWNGRADED, {
        from_plan: currentPlanName.toLowerCase(),
        to_plan: targetPlan,
      });
      toast.success(data.message);
      reset();
      onOpenChange(false);
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to process downgrade");
    },
  });

  const onSubmit = (data: DowngradeFormData) => {
    downgradeMutation.mutate({
      targetPlan: targetPlan as "pro" | "free",
      reason: data.reason,
      additionalFeedback: data.additionalFeedback,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Downgrade to {targetPlanName}</DialogTitle>
          <DialogDescription>
            Before you go, we&apos;d love to know why.
          </DialogDescription>
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
                <p className="text-xs text-destructive">
                  {errors.additionalFeedback.message}
                </p>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {targetPlan === "free"
                ? "You'll keep access until the end of your billing period."
                : "Changes will apply at your next billing date."}
            </p>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={downgradeMutation.isLoading}
              className="h-9"
            >
              Cancel
            </Button>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

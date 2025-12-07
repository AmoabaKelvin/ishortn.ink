"use client";

import { Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
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
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for downgrading</Label>
              <Controller
                name="reason"
                control={control}
                rules={{ required: "Please select a reason" }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger
                      className={errors.reason ? "border-red-500" : ""}
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
                <p className="text-sm text-red-500">{errors.reason.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalFeedback">
                What could we improve? (Optional)
              </Label>
              <Textarea
                id="additionalFeedback"
                placeholder="Share any feedback..."
                rows={3}
                className="resize-none"
                {...register("additionalFeedback", {
                  maxLength: {
                    value: 1000,
                    message: "Feedback is too long (max 1000 characters)",
                  },
                })}
              />
              {errors.additionalFeedback && (
                <p className="text-sm text-red-500">
                  {errors.additionalFeedback.message}
                </p>
              )}
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              {targetPlan === "free"
                ? "You'll keep access until the end of your billing period."
                : "Changes will apply at your next billing date."}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
              disabled={downgradeMutation.isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={downgradeMutation.isLoading}
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

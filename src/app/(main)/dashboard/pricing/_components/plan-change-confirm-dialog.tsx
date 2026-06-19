"use client";

import { Loader2 } from "lucide-react";

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
import { PLAN_PRICES_ANNUAL_USD, PLAN_PRICES_USD } from "@/lib/constants/plan-pricing";

import type { BillingInterval, Plan } from "@/lib/billing/plans";

type PlanChangeKind = "switch" | "upgrade";

/**
 * Copy for confirming an immediate-charge, in-place plan change. Only used for
 * paths that bypass the Lemon Squeezy hosted checkout (interval switch and an
 * upgrade from an existing paid plan) and so charge the card on click.
 */
export function buildPlanChangeCopy(
  kind: PlanChangeKind,
  targetPlan: Exclude<Plan, "free">,
  interval: BillingInterval,
): { title: string; description: string; note?: string; confirmLabel: string } {
  const price =
    interval === "annual" ? PLAN_PRICES_ANNUAL_USD[targetPlan] : PLAN_PRICES_USD[targetPlan];
  const planName = targetPlan === "pro" ? "Pro" : "Ultra";

  if (kind === "switch") {
    if (interval === "annual") {
      return {
        title: "Switch to annual billing?",
        description: `You'll be charged $${price} today, with credit for the unused part of your current month.`,
        note: "That's 2 months free compared to paying monthly.",
        confirmLabel: "Switch & save",
      };
    }
    return {
      title: "Switch to monthly billing?",
      description: `You'll move to $${price}/month. Any unused time on your annual plan is credited to your account.`,
      confirmLabel: "Switch to monthly",
    };
  }

  return {
    title: `Upgrade to ${planName}?`,
    description: `You'll be charged $${price} today for ${planName} ${
      interval === "annual" ? "annual" : "monthly"
    }, with credit for the unused time on your current plan.`,
    confirmLabel: `Upgrade to ${planName}`,
  };
}

type PlanChangeConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  note?: string;
  confirmLabel: string;
  isLoading: boolean;
  onConfirm: () => void;
};

export function PlanChangeConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  note,
  confirmLabel,
  isLoading,
  onConfirm,
}: PlanChangeConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {note && (
          <DialogBody>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{note}</p>
          </DialogBody>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-9"
          >
            Not now
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isLoading} className="h-9">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

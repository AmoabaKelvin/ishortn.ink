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
import { Skeleton } from "@/components/ui/skeleton";
import { buildPlanChangeCopy } from "@/lib/billing/plan-change-copy";
import { api } from "@/trpc/react";

import type { PlanChangeKind } from "@/lib/billing/plan-change-copy";
import type { BillingInterval, Plan } from "@/lib/billing/plans";

type PlanChangeConfirmDialogProps = {
  kind: PlanChangeKind;
  targetPlan: Exclude<Plan, "free">;
  interval: BillingInterval;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  onConfirm: () => void;
};

export function PlanChangeConfirmDialog({
  open,
  onOpenChange,
  kind,
  targetPlan,
  interval,
  isLoading,
  onConfirm,
}: PlanChangeConfirmDialogProps) {
  // The amount due today, prorated and discounted, comes from the provider's preview.
  const quote = api.lemonsqueezy.previewPlanChange.useQuery(
    { plan: targetPlan, interval },
    { enabled: open, staleTime: 60_000, retry: false },
  );
  const isQuoting = open && quote.isLoading;
  const { title, description, note, confirmLabel } = buildPlanChangeCopy(
    kind,
    targetPlan,
    interval,
    quote.isError ? { type: "prorated" } : quote.data,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {isQuoting ? (
            <div className="space-y-2 pt-1" aria-busy="true">
              <span className="sr-only">Calculating today&apos;s charge</span>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <DialogDescription>{description}</DialogDescription>
          )}
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
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || isQuoting}
            className="h-9"
          >
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

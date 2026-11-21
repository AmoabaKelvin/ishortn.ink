import { toast } from "sonner";

import { isPlanLimitError, requiredPlanForLimit } from "@/lib/billing/required-plan";

import { notifyPlanLimit } from "./upgrade-prompt";

import type { Plan } from "@/lib/billing/plans";

/**
 * Mutation `onError` for actions the server can reject for plan reasons: plan
 * rejections get the upgrade toast, anything else the plain error toast.
 */
export function toastMutationError(
  error: { message: string; data?: { code?: string } | null },
  source: string,
  currentPlan?: Plan,
) {
  if (isPlanLimitError(error)) {
    notifyPlanLimit(error.message, source, requiredPlanForLimit(error.message, currentPlan));
    return;
  }
  toast.error(error.message);
}

import { toast } from "sonner";

import { buildUpgradeUrl } from "@/lib/billing/upgrade";

import { POSTHOG_EVENTS, trackEvent } from "./events";

import type { UpgradePlan } from "@/lib/billing/upgrade";

/**
 * Surface an actionable upgrade prompt at a real plan-limit moment.
 * Tracks that the limit was hit, and tracks the click if the user follows
 * the upgrade CTA to the pricing page with `requiredPlan` preselected.
 */
export function notifyPlanLimit(message: string, source: string, requiredPlan: UpgradePlan) {
  trackEvent(POSTHOG_EVENTS.PLAN_LIMIT_REACHED, { source });
  toast.error(message, {
    action: {
      label: "Upgrade",
      onClick: () => {
        trackUpgradeClick(source);
        window.location.href = buildUpgradeUrl(requiredPlan, source);
      },
    },
  });
}

/** Track a click on a standing upgrade CTA (sidebar, modal, etc.). */
export function trackUpgradeClick(source: string) {
  trackEvent(POSTHOG_EVENTS.UPGRADE_PROMPT_CLICKED, { source });
}

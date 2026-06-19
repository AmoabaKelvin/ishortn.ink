import { toast } from "sonner";

import { POSTHOG_EVENTS, trackEvent } from "./events";

/**
 * Surface an actionable upgrade prompt at a real plan-limit moment.
 * Tracks that the limit was hit, and tracks the click if the user follows
 * the upgrade CTA.
 */
export function notifyPlanLimit(message: string, source: string) {
  trackEvent(POSTHOG_EVENTS.PLAN_LIMIT_REACHED, { source });
  toast.error(message, {
    action: {
      label: "Upgrade",
      onClick: () => {
        trackEvent(POSTHOG_EVENTS.UPGRADE_PROMPT_CLICKED, { source });
        window.location.href = "/dashboard/pricing";
      },
    },
  });
}

/** Track a click on a standing upgrade CTA (sidebar, modal, etc.). */
export function trackUpgradeClick(source: string) {
  trackEvent(POSTHOG_EVENTS.UPGRADE_PROMPT_CLICKED, { source });
}

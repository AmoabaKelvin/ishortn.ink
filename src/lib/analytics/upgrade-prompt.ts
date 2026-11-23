import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { buildUpgradeUrl } from "@/lib/billing/upgrade";

import { POSTHOG_EVENTS, trackEvent } from "./events";

import type { UpgradePlan } from "@/lib/billing/upgrade";

/**
 * Surface an actionable upgrade prompt at a real plan-limit moment.
 * Tracks that the limit was hit and that the prompt was shown, and tracks the click if the user
 * follows the upgrade CTA to the pricing page with `requiredPlan` preselected.
 */
export function notifyPlanLimit(message: string, source: string, requiredPlan: UpgradePlan) {
  trackEvent(POSTHOG_EVENTS.PLAN_LIMIT_REACHED, { source });
  trackUpgradeShown(source);
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

/** Track an impression of an upgrade prompt; pairs with `trackUpgradeClick` by `source`. */
export function trackUpgradeShown(source: string) {
  trackEvent(POSTHOG_EVENTS.UPGRADE_PROMPT_SHOWN, { source });
}

/**
 * Track one impression per mount, the first time `enabled` is true (the prompt is on screen).
 * Re-renders, and hiding and showing again within the same mount, don't count again; a prompt
 * whose `source` changes while mounted (the sidebar CTA reaching the link limit) counts once more
 * so its clicks still pair with an impression.
 */
export function useTrackUpgradeShown(source: string, enabled = true) {
  const trackedSource = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || trackedSource.current === source) return;
    trackedSource.current = source;
    trackUpgradeShown(source);
  }, [enabled, source]);
}

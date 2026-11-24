import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { PLAN_NAMES } from "@/lib/billing/entitlements";
import { promoOfferLine } from "@/lib/billing/promo";
import { buildUpgradeUrl } from "@/lib/billing/upgrade";

import { POSTHOG_EVENTS, trackEvent } from "./events";

import type { Promo } from "@/lib/billing/promo";
import type { UpgradePlan } from "@/lib/billing/upgrade";

/**
 * Extra impression/click properties: `promo` is the code of the offer the prompt showed,
 * `hidden_clicks` the clicks the Free analytics window hid from an analytics page.
 */
export type UpgradePromptProperties = { promo?: string; hidden_clicks?: number };

/**
 * Surface an actionable upgrade prompt at a real plan-limit moment.
 * Tracks that the limit was hit and that the prompt was shown, and tracks the click if the user
 * follows the upgrade CTA to the pricing page with `requiredPlan` preselected. With a `promo`
 * (accounts that would start a new checkout, while it runs) the toast also states the offer.
 */
export function notifyPlanLimit(
  message: string,
  source: string,
  requiredPlan: UpgradePlan,
  promo?: Promo | null,
) {
  const properties = promo ? { promo: promo.code } : undefined;
  trackEvent(POSTHOG_EVENTS.PLAN_LIMIT_REACHED, { source });
  trackUpgradeShown(source, properties);
  toast.error(message, {
    description: promo ? promoOfferLine(promo, PLAN_NAMES[requiredPlan]) : undefined,
    action: {
      label: "Upgrade",
      onClick: () => {
        trackUpgradeClick(source, properties);
        window.location.href = buildUpgradeUrl(requiredPlan, source, promo);
      },
    },
  });
}

/** Track a click on a standing upgrade CTA (sidebar, modal, etc.). */
export function trackUpgradeClick(source: string, properties?: UpgradePromptProperties) {
  trackEvent(POSTHOG_EVENTS.UPGRADE_PROMPT_CLICKED, { source, ...properties });
}

/** Track an impression of an upgrade prompt; pairs with `trackUpgradeClick` by `source`. */
export function trackUpgradeShown(source: string, properties?: UpgradePromptProperties) {
  trackEvent(POSTHOG_EVENTS.UPGRADE_PROMPT_SHOWN, { source, ...properties });
}

/**
 * Track one impression per mount, the first time `enabled` is true (the prompt is on screen).
 * Re-renders, and hiding and showing again within the same mount, don't count again; a prompt
 * whose `source` changes while mounted (the sidebar CTA reaching the link limit) counts once more
 * so its clicks still pair with an impression.
 */
export function useTrackUpgradeShown(
  source: string,
  enabled = true,
  properties?: UpgradePromptProperties,
) {
  const trackedSource = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || trackedSource.current === source) return;
    trackedSource.current = source;
    trackUpgradeShown(source, properties);
  }, [enabled, source, properties]);
}

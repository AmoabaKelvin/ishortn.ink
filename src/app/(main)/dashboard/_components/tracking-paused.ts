import type { Plan } from "@/lib/billing/plans";
import type { EventTrackingPause } from "@/server/lib/event-usage";

export const TRACKING_PAUSED_DISMISS_MS = 24 * 60 * 60 * 1000;

// Counters reset at the start of the month in UTC (the Workers clock), so dates render in UTC to
// keep the server and client output identical.
export const formatResetDay = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Pricing link that preselects a plan without starting checkout (`?plan=` does that). */
export function pricingHighlightHref(
  plan: "pro" | "ultra",
  source: string,
  extraParams: Record<string, string> = {},
) {
  const params = new URLSearchParams({ highlight: plan, source, ...extraParams });
  return `/dashboard/pricing?${params.toString()}`;
}

/** The next plan up for an account whose event tracking is paused; Ultra has no event cap. */
export function eventsUpgradeTarget(plan: Plan): { plan: "pro" | "ultra"; label: string } | null {
  if (plan === "free") return { plan: "pro", label: "Upgrade to Pro" };
  if (plan === "pro") return { plan: "ultra", label: "Upgrade to Ultra" };
  return null;
}

/** Whether a banner dismissal stored as an epoch-ms string is still within its 24 hours. */
export function isDismissalActive(stored: string | null, now: number) {
  const dismissedAt = Number(stored);
  if (!stored || !Number.isFinite(dismissedAt)) return false;
  return now - dismissedAt < TRACKING_PAUSED_DISMISS_MS && dismissedAt <= now;
}

type SubscriptionSummary = {
  plan: Plan;
  isTeamWorkspace: boolean;
  usage: { events: { paused: EventTrackingPause | null } };
};

/**
 * What the dashboard-wide paused-tracking banner shows, or null when it is hidden: team
 * workspaces have no personal event cap, and Ultra has no cap at all.
 */
export function trackingPausedBannerState(subscription: SubscriptionSummary | null) {
  if (!subscription || subscription.isTeamWorkspace) return null;
  const pause = subscription.usage.events.paused;
  const target = eventsUpgradeTarget(subscription.plan);
  if (!pause || !target) return null;
  return { pause, target };
}

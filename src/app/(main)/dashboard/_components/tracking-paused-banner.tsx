"use client";

import { IconAlertTriangle, IconArrowUpRight, IconX } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";
import { trackUpgradeClick, useTrackUpgradeShown } from "@/lib/analytics/upgrade-prompt";
import { PLAN_NAMES } from "@/lib/billing/entitlements";
import { promoOfferLine } from "@/lib/billing/promo";

import { formatResetDay, isDismissalActive, pricingHighlightHref } from "./tracking-paused";

import type { trackingPausedBannerState } from "./tracking-paused";

const DISMISS_KEY = "ishortn:tracking-paused-dismissed-at";
const DISMISS_EVENT = "ishortn:tracking-paused:dismiss";
const SEEN_KEY = "ishortn:tracking-paused-seen";
const CTA_SOURCE = "events_paused_banner";

function subscribeDismissed(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const readDismissed = () => {
  try {
    return isDismissalActive(window.localStorage.getItem(DISMISS_KEY), Date.now());
  } catch {
    return false;
  }
};

// Hidden on the server so hydration matches; the banner enters once the client has read the
// stored dismissal. The dashboard layout stays mounted across navigations, so it enters only once.
const readDismissedOnServer = () => true;

const dismiss = () => {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable (private mode); the banner then just stays.
  }
  window.dispatchEvent(new Event(DISMISS_EVENT));
};

type TrackingPausedBannerProps = NonNullable<ReturnType<typeof trackingPausedBannerState>>;

export function TrackingPausedBanner({ pause, target, promo }: TrackingPausedBannerProps) {
  const pathname = usePathname();
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, readDismissedOnServer);
  // The pricing page is where the CTA leads, so the banner would only repeat it there.
  const visible = !dismissed && !pathname?.startsWith("/dashboard/pricing");
  useTrackUpgradeShown(CTA_SOURCE, visible);

  useEffect(() => {
    if (!visible) return;
    try {
      if (window.sessionStorage.getItem(SEEN_KEY)) return;
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      return;
    }
    trackEvent(POSTHOG_EVENTS.PLAN_LIMIT_REACHED, { source: "events_paused" });
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
      <IconAlertTriangle size={16} stroke={1.5} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0">
          Tracking paused on {formatResetDay(pause.pausedAt)}:{" "}
          <span className="font-medium tabular-nums">{pause.dropped.toLocaleString()}</span>{" "}
          {pause.dropped === 1 ? "click" : "clicks"} went through but{" "}
          {pause.dropped === 1 ? "wasn't" : "weren't"} recorded. Resets{" "}
          {formatResetDay(pause.resetsAt)}.
          {promo && (
            <>
              {" "}
              {promoOfferLine(promo, PLAN_NAMES[target.plan])} Upgrading resumes tracking straight
              away.
            </>
          )}
        </p>
        <Link
          href={pricingHighlightHref(
            target.plan,
            CTA_SOURCE,
            promo ? { utm_campaign: promo.utmCampaign } : {},
          )}
          onClick={() => trackUpgradeClick(CTA_SOURCE)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white transition-[background-color,transform] hover:bg-blue-700 active:scale-[0.97]"
        >
          {target.label}
          <IconArrowUpRight size={14} stroke={2} />
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss for 24 hours"
        className="-mr-1 shrink-0 rounded-md p-1 transition-colors hover:bg-amber-100 dark:hover:bg-amber-500/20 sm:mt-0.5"
      >
        <IconX size={14} stroke={1.5} />
      </button>
    </div>
  );
}

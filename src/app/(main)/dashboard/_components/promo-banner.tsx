"use client";

import { IconArrowUpRight, IconTag, IconX } from "@tabler/icons-react";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { trackUpgradeClick, useTrackUpgradeShown } from "@/lib/analytics/upgrade-prompt";

import { promoBannerHref, promoDismissKey } from "./promo-banner-state";

import type { Promo } from "@/lib/billing/promo";

const DISMISS_EVENT = "ishortn:promo:dismiss";
const CTA_SOURCE = "promo_banner";

function subscribeDismissed(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Hidden on the server so hydration matches; the strip enters once the client has read the
// stored dismissal. The dashboard layout stays mounted across navigations, so it enters only once.
const readDismissedOnServer = () => true;

/** Slim, dismissible offer strip for Free accounts while a promo runs. */
export function PromoBanner({ promo }: { promo: Promo }) {
  const pathname = usePathname();
  const key = promoDismissKey(promo);
  const dismissed = useSyncExternalStore(
    subscribeDismissed,
    () => {
      try {
        return window.localStorage.getItem(key) !== null;
      } catch {
        return false;
      }
    },
    readDismissedOnServer,
  );
  // The pricing page shows the offer above the plans, so the strip would only repeat it there.
  const visible = !dismissed && !pathname?.startsWith("/dashboard/pricing");
  useTrackUpgradeShown(CTA_SOURCE, visible);
  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(key, String(Date.now()));
    } catch {
      // Storage can be unavailable (private mode); the strip then just stays.
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  };

  return (
    <div className="mt-6 flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-[13px] text-neutral-700 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 dark:border-border dark:bg-card dark:text-neutral-300">
      <IconTag
        size={16}
        stroke={1.5}
        aria-hidden="true"
        className="shrink-0 text-blue-600 dark:text-blue-400"
      />
      <p className="min-w-0 flex-1">
        <span className="font-medium text-neutral-900 dark:text-foreground">{promo.label}:</span>{" "}
        {promo.percentOff}% off your first year of Pro or Ultra.{" "}
        <Link
          href={promoBannerHref(promo)}
          onClick={() => trackUpgradeClick(CTA_SOURCE)}
          className="inline-flex items-center gap-0.5 whitespace-nowrap font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          See plans
          <IconArrowUpRight size={14} stroke={1.5} aria-hidden="true" />
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={`Dismiss the ${promo.label} offer`}
        className="-mr-1 shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-neutral-300"
      >
        <IconX size={14} stroke={1.5} />
      </button>
    </div>
  );
}

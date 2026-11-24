"use client";

import { useEffect } from "react";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";

/**
 * Mounted inside ClerkFormPlaceholder. Clerk removes the placeholder once its form has rendered,
 * so the unmount marks the moment the form became usable. The event waits in the queue until
 * PostHog loads, so slow loads are still counted.
 */
export function AuthFormReady({ page }: { page: "sign-up" | "sign-in" }) {
  useEffect(
    () => () => {
      // Only count a swap to Clerk's form, not leaving the page (or Strict Mode's re-run).
      if (!document.querySelector("[data-clerk-component] > *")) return;
      trackEvent(POSTHOG_EVENTS.AUTH_FORM_READY, { ms: Math.round(performance.now()), page });
    },
    [page],
  );
  return null;
}

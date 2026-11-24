"use client";

import { useEffect, useRef } from "react";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";

import { getNavigationKind, type NavigationKind } from "./navigation-kind";

// Set once any placeholder has mounted in this document, so later mounts (sign-in ↔ sign-up
// links inside Clerk's form) count as client navigations.
let placeholderMounted = false;

type Measurement = { start: number; navigation: NavigationKind };

function startMeasurement(): Measurement {
  const [entry] = performance.getEntriesByType("navigation");
  const navigation = getNavigationKind({
    documentUrl: entry?.name,
    currentPath: window.location.pathname,
    placeholderMountedBefore: placeholderMounted,
  });
  placeholderMounted = true;
  // performance.now() counts from the document's first load, which for a client-side navigation
  // includes the time spent on the previous page; measure from this mount instead.
  return { start: navigation === "full" ? 0 : performance.now(), navigation };
}

/**
 * Mounted inside ClerkFormPlaceholder. Clerk removes the placeholder once its form has rendered,
 * so the unmount marks the moment the form became usable. The event waits in the queue until
 * PostHog loads, so slow loads are still counted.
 */
export function AuthFormReady({ page }: { page: "sign-up" | "sign-in" }) {
  // A ref survives Strict Mode's effect re-run, so the start is taken once per real mount.
  const measurement = useRef<Measurement | null>(null);

  useEffect(() => {
    measurement.current ??= startMeasurement();
    return () => {
      // Only count a swap to Clerk's form, not leaving the page (or Strict Mode's re-run).
      if (!document.querySelector("[data-clerk-component] > *") || !measurement.current) return;
      const { start, navigation } = measurement.current;
      trackEvent(POSTHOG_EVENTS.AUTH_FORM_READY, {
        ms: Math.round(performance.now() - start),
        page,
        navigation,
      });
    };
  }, [page]);
  return null;
}

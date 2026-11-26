"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { holdPostHog, trackPageview } from "@/lib/analytics/posthog";

export function PostHogScript() {
  // The pathname only triggers the effect; trackPageview reads window.location, which is the URL
  // the visitor sees even where middleware rewrites the route.
  const pathname = usePathname();
  useEffect(trackPageview, [pathname]);
  return null;
}

/** Holds PostHog back while mounted (see holdPostHog). */
export function PostHogHold() {
  useEffect(holdPostHog, []);
  return null;
}

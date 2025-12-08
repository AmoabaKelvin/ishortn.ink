"use client";

import { useEffect } from "react";

import { POSTHOG_EVENTS, trackEvent } from "@/lib/analytics/events";

type AnalyticsTrackerProps = {
  alias?: string;
  domain?: string;
  isOverview?: boolean;
};

export function AnalyticsTracker({
  alias,
  domain,
  isOverview = false,
}: AnalyticsTrackerProps) {
  useEffect(() => {
    if (isOverview) {
      trackEvent(POSTHOG_EVENTS.ANALYTICS_OVERVIEW_VIEWED);
    } else {
      trackEvent(POSTHOG_EVENTS.ANALYTICS_VIEWED, {
        alias,
        domain,
      });
    }
  }, [alias, domain, isOverview]);

  return null;
}

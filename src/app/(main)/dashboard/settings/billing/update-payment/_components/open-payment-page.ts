import { POSTHOG_EVENTS, flushTrackEvent } from "@/lib/analytics/events";

import type { PaymentUpdateSource } from "@/lib/billing/entitlements";

// Enough for PostHog to load and hand the event to sendBeacon on a slow connection, without
// holding the customer on the redirect screen for long when it can't.
const TRACK_TIMEOUT_MS = 1500;

/**
 * Records the click, then sends the customer to the payment page once the event is on its way
 * (or the timeout passes): the navigation would discard it while PostHog is still loading.
 */
export async function openPaymentPage({
  url,
  source,
  navigate,
  track = flushTrackEvent,
}: {
  url: string | null;
  source: PaymentUpdateSource | null;
  navigate: (url: string) => void;
  track?: typeof flushTrackEvent;
}) {
  await track(
    POSTHOG_EVENTS.PAYMENT_UPDATE_CLICKED,
    { source, opened: !!url },
    { timeoutMs: TRACK_TIMEOUT_MS },
  );
  if (url) navigate(url);
}

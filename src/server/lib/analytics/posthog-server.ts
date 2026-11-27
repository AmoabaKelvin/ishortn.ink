import { env } from "@/env.mjs";
import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";

const log = logger.child({ component: "posthog-server" });

export type ServerEventName =
  | "checkout_started"
  | "order_completed"
  | "extension_connected"
  | "extension_link_created"
  | "extension_limit_hit";

/**
 * Sends one event to PostHog's capture endpoint after the response, under the user's id (the
 * same distinct id the browser identifies with). No-op when PostHog isn't configured.
 */
export function captureServerEvent(
  distinctId: string,
  event: ServerEventName,
  properties: Record<string, string | number | boolean> = {},
): void {
  const host = env.NEXT_PUBLIC_POSTHOG_HOST;
  const apiKey = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!host || !apiKey) return;

  const send = fetch(new URL("/i/v0/e/", host), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      event,
      distinct_id: distinctId,
      properties: { ...properties, $lib: "ishortn-server" },
      timestamp: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(5000),
  }).then((response) => {
    if (!response.ok) log.warn({ event, status: response.status }, "posthog capture failed");
  });
  void runBackgroundTask(send).catch((err) => log.warn({ err, event }, "posthog capture failed"));
}

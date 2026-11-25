"use client";

import { withPostHog, withPostHogNow } from "./posthog";

/**
 * PostHog event names for tracking user activities
 */
export const POSTHOG_EVENTS = {
  // Link events
  LINK_CREATED: "link_created",
  LINK_CREATED_WITH_PASSWORD: "link_created_with_password",
  LINK_DELETED: "link_deleted",
  LINK_QUICK_SHORTENED: "link_quick_shortened",
  LINK_PASSWORD_CHANGED: "link_password_changed",
  LINK_MOVED_TO_FOLDER: "link_moved_to_folder",
  LINKS_EXPORTED: "links_exported",

  // Analytics events
  ANALYTICS_VIEWED: "analytics_viewed",
  ANALYTICS_OVERVIEW_VIEWED: "analytics_overview_viewed",
  // Shared read-only link stats (/stats/<token>)
  STATS_SHARE_ENABLED: "stats_share_enabled",
  STATS_SHARE_DISABLED: "stats_share_disabled",
  STATS_SHARE_RESET: "stats_share_reset",
  STATS_SHARE_COPIED: "stats_share_copied",

  // Verified clicks feature
  VERIFIED_CLICKS_ENABLED: "verified_clicks_enabled",
  VERIFIED_CLICKS_DISABLED: "verified_clicks_disabled",

  // API events
  API_KEY_CREATED: "api_key_created",
  API_KEY_REVOKED: "api_key_revoked",

  // Domain events
  CUSTOM_DOMAIN_ADDED: "custom_domain_added",
  CUSTOM_DOMAIN_DELETED: "custom_domain_deleted",

  // QR Code events
  QR_CODE_CREATED: "qr_code_created",
  QR_CODE_DOWNLOADED: "qr_code_downloaded",

  // Folder events
  FOLDER_CREATED: "folder_created",

  // Subscription events
  SUBSCRIPTION_UPGRADED: "subscription_upgraded",
  SUBSCRIPTION_DOWNGRADED: "subscription_downgraded",
  // Pause offered in the cancel flow (downgrade-feedback-modal.tsx)
  CANCEL_OFFER_SHOWN: "cancel_offer_shown",
  SUBSCRIPTION_PAUSED: "subscription_paused",

  // Upgrade prompt events
  PLAN_LIMIT_REACHED: "plan_limit_reached",
  UPGRADE_PROMPT_SHOWN: "upgrade_prompt_shown",
  UPGRADE_PROMPT_CLICKED: "upgrade_prompt_clicked",
  PAYMENT_UPDATE_CLICKED: "payment_update_clicked",

  // "How did you find iShortn?" prompt for paid accounts
  ACQUISITION_PROMPT_SHOWN: "acquisition_prompt_shown",
  ACQUISITION_PROMPT_SUBMITTED: "acquisition_prompt_submitted",
  ACQUISITION_PROMPT_DISMISSED: "acquisition_prompt_dismissed",

  // Monthly-to-annual billing offer (annual-switch-card.tsx)
  ANNUAL_SWITCH_CARD_SHOWN: "annual_switch_card_shown",
  ANNUAL_SWITCH_CARD_CLICKED: "annual_switch_card_clicked",
  ANNUAL_SWITCH_CARD_DISMISSED: "annual_switch_card_dismissed",

  // Clerk replaced the sign-up/sign-in placeholder (auth-form-ready.tsx)
  AUTH_FORM_READY: "auth_form_ready",
} as const;

type PostHogEventName = (typeof POSTHOG_EVENTS)[keyof typeof POSTHOG_EVENTS];

type EventProperties = Record<string, string | number | boolean | null | undefined>;

/**
 * Track an event in PostHog. Events sent before PostHog has loaded are queued and sent, with
 * the time they happened, once it has.
 */
export function trackEvent(eventName: PostHogEventName, properties?: EventProperties) {
  // eslint-disable-next-line anti-slop/no-runtime-typeof -- SSR guard
  if (typeof window !== "undefined") {
    const timestamp = new Date();
    withPostHog((posthog) => posthog.capture(eventName, properties, { timestamp }));
  }
}

/**
 * Track an event that is followed by a full page navigation, which discards events still
 * waiting for PostHog to load. Loads PostHog straight away and sends the event at once, skipping
 * the batch queue, on a request that outlives the page (posthog-js 1.236 uses a keepalive fetch
 * and ignores `transport`; later versions honour the sendBeacon request). Resolves once it is
 * sent or after `timeoutMs`; await it before navigating.
 */
export function flushTrackEvent(
  eventName: PostHogEventName,
  properties: EventProperties | undefined,
  { timeoutMs }: { timeoutMs: number },
) {
  // eslint-disable-next-line anti-slop/no-runtime-typeof -- SSR guard
  if (typeof window === "undefined") return Promise.resolve();
  const timestamp = new Date();
  return withPostHogNow(
    (posthog) =>
      posthog.capture(eventName, properties, {
        timestamp,
        send_instantly: true,
        transport: "sendBeacon",
      }),
    timeoutMs,
  );
}

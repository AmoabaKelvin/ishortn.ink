"use client";

import posthog from "posthog-js";

/**
 * PostHog event names for tracking user activities
 */
export const POSTHOG_EVENTS = {
  // Link events
  LINK_CREATED: "link_created",
  LINK_CREATED_WITH_PASSWORD: "link_created_with_password",
  LINK_DELETED: "link_deleted",
  LINK_PASSWORD_CHANGED: "link_password_changed",
  LINK_MOVED_TO_FOLDER: "link_moved_to_folder",
  LINKS_EXPORTED: "links_exported",

  // Analytics events
  ANALYTICS_VIEWED: "analytics_viewed",
  ANALYTICS_OVERVIEW_VIEWED: "analytics_overview_viewed",

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
} as const;

type PostHogEventName = (typeof POSTHOG_EVENTS)[keyof typeof POSTHOG_EVENTS];

/**
 * Track an event in PostHog
 */
export function trackEvent(
  eventName: PostHogEventName,
  properties?: Record<string, unknown>
) {
  if (typeof window !== "undefined") {
    posthog.capture(eventName, properties);
  }
}

// Client-safe webhook constants, shared by the schema, the tRPC input and the settings UI.

export const WEBHOOK_EVENT_TYPES = [
  "link.created",
  "link.updated",
  "link.deleted",
  "domain.verified",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WEBHOOK_URL_MAX_LENGTH = 2048;
export const WEBHOOK_DESCRIPTION_MAX_LENGTH = 255;

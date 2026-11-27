import { z } from "zod";

import {
  WEBHOOK_DESCRIPTION_MAX_LENGTH,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_URL_MAX_LENGTH,
} from "@/lib/webhooks";

const url = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(WEBHOOK_URL_MAX_LENGTH, `URL must be ${WEBHOOK_URL_MAX_LENGTH} characters or less`);

const description = z
  .string()
  .trim()
  .max(
    WEBHOOK_DESCRIPTION_MAX_LENGTH,
    `Description must be ${WEBHOOK_DESCRIPTION_MAX_LENGTH} characters or less`,
  );

const events = z
  .array(z.enum(WEBHOOK_EVENT_TYPES))
  .min(1, "Choose at least one event")
  .transform((list) => [...new Set(list)]);

export const createWebhookInput = z.object({ url, description: description.optional(), events });

export const updateWebhookInput = z.object({
  id: z.number().int(),
  url: url.optional(),
  description: description.optional(),
  events: events.optional(),
  enabled: z.boolean().optional(),
});

export const webhookIdInput = z.object({ id: z.number().int() });

export type CreateWebhookInput = z.infer<typeof createWebhookInput>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookInput>;
export type WebhookIdInput = z.infer<typeof webhookIdInput>;

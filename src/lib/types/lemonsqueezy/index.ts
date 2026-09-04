import { z } from "zod";

const customDataSchema = z.object({ user_id: z.string() });

/** Every Lemon Squeezy webhook, whatever the event, identifies the user it concerns. */
export const lemonsqueezyWebhookEnvelopeSchema = z.object({
  meta: z.object({
    event_name: z.string(),
    custom_data: customDataSchema,
  }),
});

export const lemonsqueezySubscriptionEventNameSchema = z.enum([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_expired",
]);

export const lemonsqueezySubscriptionAttributesSchema = z.object({
  customer_id: z.number(),
  order_id: z.number(),
  product_id: z.number(),
  variant_id: z.number(),
  status: z.string(),
  card_brand: z.string().nullable(),
  card_last_four: z.string().nullable(),
  renews_at: z.string(),
  ends_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const lemonsqueezySubscriptionEventSchema = z.object({
  meta: z.object({
    event_name: lemonsqueezySubscriptionEventNameSchema,
    custom_data: customDataSchema,
  }),
  data: z.object({
    id: z.string(),
    attributes: lemonsqueezySubscriptionAttributesSchema,
  }),
});

export type LemonsqueezySubscriptionEvent = z.infer<typeof lemonsqueezySubscriptionEventSchema>;

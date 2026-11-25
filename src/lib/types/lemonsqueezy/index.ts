import { z } from "zod";

// Only the in-app checkout sets user_id. Subscriptions created elsewhere (the
// Lemon Squeezy dashboard, a shared checkout link) arrive without it.
const customDataSchema = z.object({ user_id: z.string().optional() }).nullish();

export const lemonsqueezyWebhookEnvelopeSchema = z.object({
  meta: z.object({
    event_name: z.string(),
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
  user_email: z.string().nullish(),
  card_brand: z.string().nullable(),
  card_last_four: z.string().nullable(),
  renews_at: z.string(),
  ends_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  // Set while payment collection is paused; resumes_at is when billing restarts.
  pause: z.object({ resumes_at: z.string().nullish() }).nullish(),
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

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

// An order created outside the in-app checkout may carry any custom data; a value of another
// type reads as unset rather than failing the delivery.
const customString = z.string().optional().catch(undefined);
const orderCustomDataSchema = z
  .object({
    user_id: customString,
    discount_code: customString,
    source: customString,
    utm_source: customString,
    utm_medium: customString,
    utm_campaign: customString,
    utm_term: customString,
    utm_content: customString,
  })
  .nullish()
  .catch(null);

export const lemonsqueezyOrderEventSchema = z.object({
  meta: z.object({
    event_name: z.literal("order_created"),
    custom_data: orderCustomDataSchema,
  }),
  data: z.object({
    id: z.string(),
    attributes: z.object({
      status: z.string(),
      currency: z.string(),
      // Amounts are in cents.
      total: z.number(),
      total_usd: z.number(),
      test_mode: z.boolean().optional(),
      first_order_item: z.object({ variant_id: z.number(), product_id: z.number() }).nullish(),
    }),
  }),
});

export type LemonsqueezyOrderEvent = z.infer<typeof lemonsqueezyOrderEventSchema>;

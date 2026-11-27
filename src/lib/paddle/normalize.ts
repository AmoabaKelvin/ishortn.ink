import { z } from "zod";

import { getPaddleConfig, planFromPaddlePrice } from "@/lib/paddle/config";

import type { BillingInterval } from "@/lib/billing/plans";
import type { PaddleConfig, PaidPlan } from "@/lib/paddle/config";

// Paddle allows any JSON in custom_data; a value of another type reads as unset rather than
// failing the delivery.
const customDataSchema = z
  .object({
    user_id: z.string().min(1).optional().catch(undefined),
    plan: z.enum(["pro", "ultra"]).optional().catch(undefined),
    interval: z.enum(["monthly", "annual"]).optional().catch(undefined),
  })
  .nullish()
  .catch(null);

// The fields of Paddle's subscription entity that the app reads.
export const paddleSubscriptionSchema = z.object({
  id: z.string(),
  status: z.string(),
  customer_id: z.string(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  next_billed_at: z.string().nullish(),
  canceled_at: z.string().nullish(),
  scheduled_change: z
    .object({
      action: z.string(),
      effective_at: z.string().nullish(),
      resume_at: z.string().nullish(),
    })
    .nullish(),
  items: z.array(z.object({ price: z.object({ id: z.string() }).nullish() })).nullish(),
  custom_data: customDataSchema,
});

export type PaddleSubscription = z.infer<typeof paddleSubscriptionSchema>;

export type NormalizedPaddleSubscription = {
  providerSubscriptionId: string;
  providerCustomerId: string;
  providerPriceId: string | null;
  plan: PaidPlan;
  interval: BillingInterval;
  // The app's (Lemon Squeezy) status vocabulary, so plans.ts, entitlements.ts and grace.ts read
  // Paddle subscriptions unchanged.
  status: string;
  renewsAt: Date | null;
  endsAt: Date | null;
  pausedUntil: Date | null;
  createdAt: Date | null;
  providerUpdatedAt: Date | null;
  userIdHint: string | null;
  unrecognisedPrice: boolean;
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolvePlan(sub: PaddleSubscription, config: PaddleConfig | null) {
  const priceId = sub.items?.[0]?.price?.id || null;
  const known = priceId ? planFromPaddlePrice(priceId, config) : null;
  if (known) return { priceId, ...known, unrecognisedPrice: false };
  return {
    priceId,
    plan: sub.custom_data?.plan ?? "pro",
    interval: sub.custom_data?.interval ?? "monthly",
    unrecognisedPrice: true,
  };
}

export function normalizePaddleSubscription(
  sub: PaddleSubscription,
  config: PaddleConfig | null = getPaddleConfig(),
): NormalizedPaddleSubscription {
  const { priceId, plan, interval, unrecognisedPrice } = resolvePlan(sub, config);
  const change = sub.scheduled_change ?? null;
  const updatedAt = parseDate(sub.updated_at);

  let status = sub.status;
  let renewsAt = parseDate(sub.next_billed_at);
  let endsAt: Date | null = null;
  let pausedUntil: Date | null = null;

  switch (sub.status) {
    case "trialing":
    case "active":
    case "past_due":
      if (sub.status === "trialing") status = "on_trial";
      if (change?.action === "cancel") {
        // A scheduled cancel keeps access until the end of the paid period; `cancelled` with an
        // `endsAt` is what isSubscriptionEntitled honours. past_due keeps its own status.
        if (sub.status !== "past_due") status = "cancelled";
        endsAt = parseDate(change.effective_at);
        renewsAt = null;
      } else if (change?.action === "pause") {
        pausedUntil = parseDate(change.resume_at);
      }
      break;
    case "paused":
      // Once a pause is in effect Paddle reports the scheduled resume as `action: "resume"` with
      // the date in effective_at; accept resume_at too.
      if (change?.action === "resume") {
        pausedUntil = parseDate(change.resume_at) ?? parseDate(change.effective_at);
      } else if (change?.action === "pause") {
        pausedUntil = parseDate(change.resume_at);
      }
      break;
    case "canceled":
      status = "expired";
      renewsAt = null;
      endsAt = parseDate(sub.canceled_at) ?? updatedAt;
      break;
  }

  return {
    providerSubscriptionId: sub.id,
    providerCustomerId: sub.customer_id,
    providerPriceId: priceId,
    plan,
    interval,
    status,
    renewsAt,
    endsAt,
    pausedUntil,
    createdAt: parseDate(sub.created_at),
    providerUpdatedAt: updatedAt,
    userIdHint: sub.custom_data?.user_id ?? null,
    unrecognisedPrice,
  };
}

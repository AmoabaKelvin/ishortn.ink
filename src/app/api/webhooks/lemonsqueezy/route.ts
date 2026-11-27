import crypto from "node:crypto";

import { eq } from "drizzle-orm";

import { env } from "@/env.mjs";
import { getIntervalFromVariantId, getPlanFromIds } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import {
  lemonsqueezyOrderEventSchema,
  lemonsqueezySubscriptionEventNameSchema,
  lemonsqueezySubscriptionEventSchema,
  lemonsqueezyWebhookEnvelopeSchema,
} from "@/lib/types/lemonsqueezy";
import { db } from "@/server/db";
import { subscription, user } from "@/server/db/schema";
import { captureServerEvent } from "@/server/lib/analytics/posthog-server";
import { applySubscriptionEvent } from "@/server/lib/billing/apply-subscription-event";
import { syncEntitlementsAfterBillingEvent } from "@/server/lib/entitlements/grace";

import { orderCompletedEvent } from "./order-event";
import { eventIsBehindProvider } from "./reconcile";

import type { LemonsqueezySubscriptionEvent } from "@/lib/types/lemonsqueezy";
import type { Subscription } from "@/server/db/schema";
import type {
  SubscriptionEventKind,
  SubscriptionEventResult,
} from "@/server/lib/billing/apply-subscription-event";

const log = logger.child({ webhook: "lemonsqueezy" });

// Lemon Squeezy retries any non-2xx delivery, so 5xx is reserved for failures a
// retry can fix. Retries are safe: the providerUpdatedAt ordering check turns a
// redelivered event into a no-op.
export async function POST(request: Request) {
  const secret = env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Lemon Squeezy Webhook Secret not set in .env", {
      status: 500,
    });
  }

  // First, make sure the request is from Lemon Squeezy.
  const rawBody = await request.text();
  if (!hasValidSignature(rawBody, request.headers.get("X-Signature"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const envelope = lemonsqueezyWebhookEnvelopeSchema.safeParse(body);
  if (!envelope.success) {
    return new Response("Webhook does not have meta", {
      status: 400,
    });
  }

  const eventName = envelope.data.meta.event_name;
  if (eventName === "order_created") {
    // Analytics only, so a payload it can't read is logged and still acknowledged.
    const order = lemonsqueezyOrderEventSchema.safeParse(body);
    const completed = order.success ? orderCompletedEvent(order.data) : null;
    if (!order.success) log.warn({ issues: order.error.issues }, "unreadable order payload");
    if (completed) {
      captureServerEvent(completed.user, "order_completed", completed.properties);
    }
    return new Response("OK", { status: 200 });
  }

  // The other event types carry no subscription state to apply.
  if (!lemonsqueezySubscriptionEventNameSchema.safeParse(eventName).success) {
    return new Response("OK", { status: 200 });
  }

  const event = lemonsqueezySubscriptionEventSchema.safeParse(body);
  if (!event.success) {
    log.error({ event: eventName, issues: event.error.issues }, "malformed subscription payload");
    return new Response("Malformed subscription payload", { status: 400 });
  }

  const subscriptionId = Number.parseInt(event.data.data.id);
  try {
    const { result, userId, previous } = await processWebhook(event.data);
    log.info({ event: eventName, subscriptionId, userId, result }, "processed webhook");
    if (result === "applied" && userId) {
      // A retry would be dropped as stale, so a failure here is logged rather
      // than returned; the daily entitlements reconcile catches it.
      try {
        await syncEntitlementsAfterBillingEvent(userId, previous ?? null);
      } catch (err) {
        log.error({ err, event: eventName, subscriptionId, userId }, "entitlement sync failed");
      }
    }
    if (result === "invalid_payload") {
      return new Response("Invalid updated_at", { status: 400 });
    }
    return new Response("OK", { status: 200 });
  } catch (err) {
    log.error({ err, event: eventName, subscriptionId }, "processing failed");
    return new Response("Processing failed", { status: 500 });
  }
}

function hasValidSignature(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const digest = Buffer.from(
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex"),
    "utf8",
  );
  const signature = Buffer.from(header, "utf8");
  // timingSafeEqual throws on a length mismatch instead of returning false.
  return signature.length === digest.length && crypto.timingSafeEqual(digest, signature);
}

type WebhookResult = SubscriptionEventResult | "unmatched_user";

// Subscriptions started outside the in-app checkout carry no user_id. Fall back
// to a row we already hold for the same Lemon Squeezy customer, then to the
// account with the checkout email.
async function resolveUserId({ meta, data }: LemonsqueezySubscriptionEvent) {
  const userId = meta.custom_data?.user_id;
  if (userId) return userId;

  const byCustomer = await db.query.subscription.findFirst({
    where: eq(subscription.customerId, data.attributes.customer_id),
    columns: { userId: true },
  });
  if (byCustomer) return byCustomer.userId;

  const email = data.attributes.user_email;
  if (!email) return null;
  const byEmail = await db.query.user.findFirst({
    where: eq(user.email, email),
    columns: { id: true },
  });
  return byEmail?.id ?? null;
}

type WebhookOutcome = {
  result: WebhookResult;
  userId: string | null;
  /** The subscription row before this event, for the entitlement sync. */
  previous?: Subscription | null;
};

const EVENT_KINDS = {
  subscription_created: "created",
  subscription_updated: "updated",
  subscription_cancelled: "cancelled",
  subscription_expired: "expired",
} as const satisfies Record<
  LemonsqueezySubscriptionEvent["meta"]["event_name"],
  SubscriptionEventKind
>;

/** Resolves the user and hands the event to the shared applier. */
async function processWebhook(
  webhookEvent: LemonsqueezySubscriptionEvent,
): Promise<WebhookOutcome> {
  const { meta, data } = webhookEvent;
  const { event_name } = meta;
  const subscriptionId = Number.parseInt(data.id);

  const userId = await resolveUserId(webhookEvent);
  if (!userId) {
    log.warn(
      { event: event_name, subscriptionId, customerId: data.attributes.customer_id },
      "no user matches subscription webhook by user_id, customer_id or email",
    );
    return { result: "unmatched_user", userId };
  }

  const attributes = data.attributes;
  const { variant_id: variantId, product_id: productId } = attributes;
  const outcome = await applySubscriptionEvent(
    {
      provider: "lemonsqueezy",
      kind: EVENT_KINDS[event_name],
      userId,
      subscriptionId,
      customerId: attributes.customer_id,
      orderId: attributes.order_id,
      variantId,
      productId,
      status: attributes.status,
      plan: getPlanFromIds(variantId, productId) ?? "pro",
      billingInterval: getIntervalFromVariantId(variantId),
      renewsAt: new Date(attributes.renews_at),
      endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
      pausedUntil: attributes.pause?.resumes_at ? new Date(attributes.pause.resumes_at) : null,
      createdAt: new Date(attributes.created_at),
      cardBrand: attributes.card_brand,
      cardLastFour: attributes.card_last_four,
      providerUpdatedAt: new Date(attributes.updated_at),
    },
    {
      log: log.child({ event: event_name }),
      // A provider outage throws out of here, so the delivery is retried.
      isBehindProvider: (providerUpdatedAt) =>
        eventIsBehindProvider(subscriptionId, providerUpdatedAt),
      // Once a user moves to Paddle, a late or replayed Lemon Squeezy event must not overwrite
      // the subscription Paddle now manages.
      isSuperseded: (existing) => existing.billingProvider === "paddle",
    },
  );
  return { ...outcome, userId };
}

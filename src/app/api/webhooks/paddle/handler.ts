import { eq } from "drizzle-orm";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { normalizePaddleSubscription, paddleSubscriptionSchema } from "@/lib/paddle/normalize";
import { verifyPaddleSignature } from "@/lib/paddle/webhook";
import { db } from "@/server/db";
import { subscription, user } from "@/server/db/schema";
import { applySubscriptionEvent } from "@/server/lib/billing/apply-subscription-event";
import { syncEntitlementsAfterBillingEvent } from "@/server/lib/entitlements/grace";

import type { PaddleClient } from "@/lib/paddle/client";
import type { PaddleConfig } from "@/lib/paddle/config";
import type { NormalizedPaddleSubscription } from "@/lib/paddle/normalize";
import type { SubscriptionEventKind } from "@/server/lib/billing/apply-subscription-event";

const log = logger.child({ webhook: "paddle" });

const envelopeSchema = z.object({
  event_id: z.string(),
  event_type: z.string(),
  occurred_at: z.string(),
  notification_id: z.string(),
  data: z.unknown(),
});

const UPDATE_EVENTS = new Set([
  "subscription.updated",
  "subscription.activated",
  "subscription.trialing",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
]);

const HANDLED_EVENTS = new Set([
  "subscription.created",
  "subscription.imported",
  "subscription.canceled",
  ...UPDATE_EVENTS,
]);

/** The applier kind for a subscription event, or null for events that carry no state to apply. */
export function eventKind(
  eventType: string,
  normalized: Pick<NormalizedPaddleSubscription, "status">,
): SubscriptionEventKind | null {
  if (eventType === "subscription.created" || eventType === "subscription.imported") {
    return "created";
  }
  if (eventType === "subscription.canceled") return "expired";
  if (UPDATE_EVENTS.has(eventType)) {
    // A scheduled cancel arrives as an update; routing it to `cancelled` sends the email.
    return normalized.status === "cancelled" ? "cancelled" : "updated";
  }
  return null;
}

export type PaddleWebhookDeps = {
  config: PaddleConfig | null;
  client: Pick<PaddleClient, "getCustomer"> | null;
};

// Paddle retries any non-2xx delivery and wants a response within 5 seconds, so the request path
// is indexed queries plus at most one Paddle call, and 5xx is kept for failures a retry can fix.
// Redeliveries are safe: the providerUpdatedAt ordering check turns them into no-ops.
export async function handlePaddleWebhook(
  request: Request,
  { config, client }: PaddleWebhookDeps,
): Promise<Response> {
  if (!config || !client) return new Response("Not found", { status: 404 });

  const rawBody = await request.text();
  const signature = verifyPaddleSignature(
    rawBody,
    request.headers.get("Paddle-Signature"),
    config.webhookSecret,
  );
  if (!signature.ok) {
    log.warn({ ...signature }, "rejected webhook signature");
    return new Response("Invalid signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success) return new Response("Malformed event", { status: 400 });

  const { event_id: eventId, event_type: eventType, occurred_at: occurredAt, data } = envelope.data;
  if (!HANDLED_EVENTS.has(eventType)) return new Response("OK", { status: 200 });

  const parsed = paddleSubscriptionSchema.safeParse(data);
  if (!parsed.success) {
    log.error(
      { eventId, eventType, issues: parsed.error.issues },
      "malformed subscription payload",
    );
    return new Response("Malformed subscription payload", { status: 400 });
  }

  const normalized = normalizePaddleSubscription(parsed.data, config);
  const kind = eventKind(eventType, normalized);
  if (!kind) return new Response("OK", { status: 200 });

  const subscriptionId = normalized.providerSubscriptionId;
  const logContext = { eventId, eventType, subscriptionId };
  if (normalized.unrecognisedPrice) {
    log.error(
      { ...logContext, priceId: normalized.providerPriceId, plan: normalized.plan },
      "unrecognised Paddle price; plan taken from custom_data or defaulted to pro monthly",
    );
  }
  if (!normalized.providerUpdatedAt) {
    log.error(logContext, "missing or invalid updated_at on subscription payload");
    return new Response("Invalid updated_at", { status: 400 });
  }

  try {
    const userId = await resolveUserId(normalized, client);
    if (!userId) {
      log.warn(
        { ...logContext, customerId: normalized.providerCustomerId, reason: "unmatched_user" },
        "no user matches subscription webhook by user_id, customer or email",
      );
      return new Response("OK", { status: 200 });
    }

    const { result, previous } = await applySubscriptionEvent(
      {
        provider: "paddle",
        kind,
        userId,
        providerSubscriptionId: subscriptionId,
        providerCustomerId: normalized.providerCustomerId,
        providerPriceId: normalized.providerPriceId,
        status: normalized.status,
        plan: normalized.plan,
        billingInterval: normalized.interval,
        renewsAt: normalized.renewsAt,
        endsAt: normalized.endsAt,
        pausedUntil: normalized.pausedUntil,
        createdAt: normalized.createdAt ?? new Date(occurredAt),
        // Paddle's subscription entity carries no card details.
        cardBrand: null,
        cardLastFour: null,
        providerUpdatedAt: normalized.providerUpdatedAt,
      },
      {
        log: log.child({ eventId, eventType }),
        // An import moves an existing plan over, so the user is not welcomed again.
        sendWelcome: eventType !== "subscription.imported",
      },
    );
    log.info({ ...logContext, userId, kind, result }, "processed webhook");

    if (result === "applied") {
      // A retry would be dropped as stale, so a failure here is logged rather than returned; the
      // daily entitlements reconcile catches it.
      try {
        await syncEntitlementsAfterBillingEvent(userId, previous ?? null);
      } catch (err) {
        log.error({ ...logContext, err, userId }, "entitlement sync failed");
      }
    }
    if (result === "invalid_payload") {
      return new Response("Invalid updated_at", { status: 400 });
    }
    return new Response("OK", { status: 200 });
  } catch (err) {
    log.error({ ...logContext, err }, "processing failed");
    return new Response("Processing failed", { status: 500 });
  }
}

// Subscriptions started outside the in-app checkout carry no user_id. Fall back to a row we
// already hold for the same Paddle customer, then to the account with the customer's email.
async function resolveUserId(
  normalized: NormalizedPaddleSubscription,
  client: Pick<PaddleClient, "getCustomer">,
): Promise<string | null> {
  if (normalized.userIdHint) return normalized.userIdHint;

  const byCustomer = await db.query.subscription.findFirst({
    where: eq(subscription.providerCustomerId, normalized.providerCustomerId),
    columns: { userId: true },
  });
  if (byCustomer) return byCustomer.userId;

  const customer = await client.getCustomer(normalized.providerCustomerId);
  const byEmail = await db.query.user.findFirst({
    where: eq(user.email, customer.email),
    columns: { id: true },
  });
  return byEmail?.id ?? null;
}

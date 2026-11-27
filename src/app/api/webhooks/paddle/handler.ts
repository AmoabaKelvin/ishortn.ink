import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { normalizePaddleSubscription, paddleSubscriptionSchema } from "@/lib/paddle/normalize";
import { verifyPaddleSignature } from "@/lib/paddle/webhook";
import { db } from "@/server/db";
import { subscription, user } from "@/server/db/schema";
import { captureServerEvent } from "@/server/lib/analytics/posthog-server";
import { applySubscriptionEvent } from "@/server/lib/billing/apply-subscription-event";
import { syncEntitlementsAfterBillingEvent } from "@/server/lib/entitlements/grace";

import {
  isFirstPayment,
  orderCompletedEvent,
  paddleTransactionSchema,
  paidSubscriptionId,
  transactionCard,
} from "./transaction";

import type { PaddleTransaction } from "./transaction";
import type { PaddleClient } from "@/lib/paddle/client";
import type { PaddleConfig } from "@/lib/paddle/config";
import type { NormalizedPaddleSubscription } from "@/lib/paddle/normalize";
import type { SubscriptionEventKind } from "@/server/lib/billing/apply-subscription-event";

const log = logger.child({ webhook: "paddle" });

const CUSTOMER_LOOKUP_TIMEOUT_MS = 3_000;

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
    // Paddle sends `subscription.updated` with status `canceled` before `subscription.canceled`,
    // with the same updated_at, so the second is dropped as stale; the first must do the reset.
    if (normalized.status === "expired") return "expired";
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
  if (eventType === "transaction.completed") {
    const transaction = paddleTransactionSchema.safeParse(data);
    if (!transaction.success) {
      log.error(
        { eventId, eventType, issues: transaction.error.issues },
        "malformed transaction payload",
      );
      return new Response("Malformed transaction payload", { status: 400 });
    }
    return handleTransactionCompleted(eventId, transaction.data, config);
  }
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
        // Paddle's subscription entity carries no card details; transaction.completed sets them.
        cardBrand: undefined,
        cardLastFour: undefined,
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

// The card on file and the funnel's order_completed both come from the subscription's payments.
async function handleTransactionCompleted(
  eventId: string,
  transaction: PaddleTransaction,
  config: PaddleConfig,
): Promise<Response> {
  const subscriptionId = paidSubscriptionId(transaction);
  if (!subscriptionId) return new Response("OK", { status: 200 });
  const logContext = {
    eventId,
    eventType: "transaction.completed",
    transactionId: transaction.id,
    subscriptionId,
  };

  try {
    const card = transactionCard(transaction);
    if (card) {
      const [result] = await db
        .update(subscription)
        .set(card)
        .where(
          and(
            eq(subscription.billingProvider, "paddle"),
            eq(subscription.providerSubscriptionId, subscriptionId),
          ),
        );
      if (result.affectedRows === 0) {
        // The first payment can be delivered before subscription.created writes the row; a retry
        // lands the card on it. order_completed waits too, so the retry doesn't send it twice.
        if (isFirstPayment(transaction)) {
          log.warn(logContext, "no Paddle subscription row yet for first payment; retrying");
          return new Response("Subscription not found", { status: 500 });
        }
        log.warn(logContext, "no Paddle subscription row for renewal payment");
      }
    }

    const completed = orderCompletedEvent(transaction, config);
    if (completed) {
      const account = await db.query.user.findFirst({
        where: eq(user.id, completed.userId),
        columns: { email: true },
      });
      if (account) {
        captureServerEvent(
          { id: completed.userId, email: account.email },
          "order_completed",
          completed.properties,
        );
      }
    }
    log.info(
      { ...logContext, card: Boolean(card), orderCompleted: Boolean(completed) },
      "processed webhook",
    );
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

  // Paddle drops deliveries not answered within 5s; time out first so the retry can succeed.
  const customer = await client.getCustomer(normalized.providerCustomerId, {
    timeoutMs: CUSTOMER_LOOKUP_TIMEOUT_MS,
  });
  const byEmail = await db.query.user.findFirst({
    where: eq(user.email, customer.email),
    columns: { id: true },
  });
  return byEmail?.id ?? null;
}

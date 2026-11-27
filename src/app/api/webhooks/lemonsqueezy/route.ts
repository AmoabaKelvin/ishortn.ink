import crypto from "node:crypto";

import { and, eq, isNull, lt, or } from "drizzle-orm";

import { env } from "@/env.mjs";
import { getIntervalFromVariantId, getPlanFromIds } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import {
  lemonsqueezyOrderEventSchema,
  lemonsqueezySubscriptionEventNameSchema,
  lemonsqueezySubscriptionEventSchema,
  lemonsqueezyWebhookEnvelopeSchema,
} from "@/lib/types/lemonsqueezy";
import { runBackgroundTask } from "@/lib/utils/background";
import { db } from "@/server/db";
import { subscription, user } from "@/server/db/schema";
import { captureServerEvent } from "@/server/lib/analytics/posthog-server";
import {
  applyBillingEventEntitlements,
  syncEntitlementsAfterBillingEvent,
} from "@/server/lib/entitlements/grace";
import {
  sendSubscriptionCancelledEmail,
  sendWelcomeEmail,
} from "@/server/lib/notifications/billing";

import { orderCompletedEvent } from "./order-event";
import { eventIsBehindProvider } from "./reconcile";

import type { LemonsqueezySubscriptionEvent } from "@/lib/types/lemonsqueezy";
import type { Subscription } from "@/server/db/schema";
import type { BillingRecipient } from "@/server/lib/notifications/billing";
import type { MySqlRawQueryResult } from "drizzle-orm/mysql2";

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
      captureServerEvent(completed.distinctId, "order_completed", completed.properties);
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

type WebhookResult =
  | "applied"
  | "stale"
  | "no_row_matched"
  | "user_not_found"
  | "unmatched_user"
  | "invalid_payload";

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

/** Applies the event, throwing on any failure a retry could fix. */
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

  const lemonsqueezySubscription = data.attributes;
  const customerId = lemonsqueezySubscription.customer_id;
  const orderId = lemonsqueezySubscription.order_id;
  const renewsAt = new Date(lemonsqueezySubscription.renews_at);
  const createdAt = new Date(lemonsqueezySubscription.created_at);
  const endsAt = lemonsqueezySubscription.ends_at;
  const status = lemonsqueezySubscription.status;
  const pausedUntil = lemonsqueezySubscription.pause?.resumes_at
    ? new Date(lemonsqueezySubscription.pause.resumes_at)
    : null;
  const productId = lemonsqueezySubscription.product_id;
  const variantId = lemonsqueezySubscription.variant_id;
  const plan = getPlanFromIds(variantId, productId) ?? "pro";
  const billingInterval = getIntervalFromVariantId(variantId);

  // payment data
  const cardBrand = lemonsqueezySubscription.card_brand;
  const cardLastFour = lemonsqueezySubscription.card_last_four;
  const providerUpdatedAt = new Date(lemonsqueezySubscription.updated_at);

  // A malformed timestamp would poison the ordering marker on a billing row
  // and make every later comparison meaningless, so refuse the delivery.
  if (Number.isNaN(providerUpdatedAt.getTime())) {
    log.error(
      { event: event_name, subscriptionId, userId },
      "missing or invalid updated_at on subscription payload",
    );
    return { result: "invalid_payload", userId };
  }

  // Deliveries can arrive out of order or be replayed. Every event must
  // therefore name the subscription it is about and be newer than the event
  // we last applied — otherwise a stale event for a cancelled subscription
  // can revoke the row a newer subscription now owns.
  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });

  let isStale = false;

  if (existing?.providerUpdatedAt) {
    isStale = existing.providerUpdatedAt >= providerUpdatedAt;
  } else if (existing) {
    // A row without a marker accepts the first event it sees, which may be a
    // retry of an old one. Check that event against the provider's current
    // state before letting it become the baseline. A provider outage throws
    // out of here, so the delivery is retried.
    isStale = await eventIsBehindProvider(subscriptionId, providerUpdatedAt);
  }

  // MySQL's ON DUPLICATE KEY UPDATE takes no WHERE clause, and the guarded
  // updates below let a markerless row through, so decide here for every
  // event rather than relying on the predicate.
  if (isStale) {
    log.warn(
      {
        event: event_name,
        subscriptionId,
        userId,
        storedSubscriptionId: existing?.subscriptionId ?? null,
      },
      "ignoring event older than stored or provider state",
    );
    return { result: "stale", userId };
  }

  const currentSubscription = and(
    eq(subscription.userId, userId),
    eq(subscription.subscriptionId, subscriptionId),
    or(
      isNull(subscription.providerUpdatedAt),
      lt(subscription.providerUpdatedAt, providerUpdatedAt),
    ),
  );

  /**
   * Guarded updates match nothing when the event is stale or names a
   * subscription we no longer hold. Both are expected, but so is a row whose
   * subscriptionId was never populated — log rather than fail silently.
   */
  const updateResult = (result: MySqlRawQueryResult): WebhookResult => {
    if (result[0]!.affectedRows > 0) return "applied";
    log.warn(
      {
        event: event_name,
        subscriptionId,
        userId,
        storedSubscriptionId: existing?.subscriptionId ?? null,
        reason: !existing
          ? "no subscription row for user"
          : existing.subscriptionId !== subscriptionId
            ? "event names a different subscription"
            : "event older than stored state",
      },
      "subscription webhook matched no rows",
    );
    return "no_row_matched";
  };

  const paidPlan = plan === "ultra" ? "ultra" : "pro";

  // Billing emails go out after the write and outside the response: a mail
  // failure must not fail the delivery, and a retry would be dropped as stale.
  const emailOwner = (send: (recipient: BillingRecipient) => Promise<boolean>) => {
    void runBackgroundTask(
      (async () => {
        const owner = await db.query.user.findFirst({
          where: eq(user.id, userId),
          columns: { email: true, name: true },
        });
        if (!owner?.email) {
          log.error(
            { event: event_name, subscriptionId, userId },
            "user has no email for billing email",
          );
          return;
        }
        await send({ userId, email: owner.email, name: owner.name });
      })(),
    );
  };

  if (event_name === "subscription_created") {
    const account = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { email: true, name: true },
    });

    // Not retryable: the account was deleted before the event arrived.
    if (!account) {
      log.error(
        { event: event_name, subscriptionId, userId },
        "user not found for subscription_created",
      );
      return { result: "user_not_found", userId };
    }

    await db
      .insert(subscription)
      .values({
        userId: userId,
        subscriptionId,
        customerId,
        orderId,
        status,
        plan,
        billingInterval,
        variantId,
        productId,
        cardBrand,
        cardLastFour,
        renewsAt: new Date(renewsAt),
        createdAt: new Date(createdAt),
        endsAt: endsAt ? new Date(endsAt) : null,
        providerUpdatedAt,
      })
      .onDuplicateKeyUpdate({
        // A returning customer already has a row, so refresh the full
        // subscription state — not just status/dates — or their plan,
        // interval, and subscriptionId would stay stale.
        set: {
          subscriptionId,
          customerId,
          orderId,
          status,
          plan,
          billingInterval,
          variantId,
          productId,
          cardBrand,
          cardLastFour,
          renewsAt: new Date(renewsAt),
          endsAt: endsAt ? new Date(endsAt) : null,
          providerUpdatedAt,
        },
      });

    const email = account.email;

    if (!email) {
      log.error({ event: event_name, subscriptionId, userId }, "user has no email for welcome");
    } else {
      void runBackgroundTask(sendWelcomeEmail({ userId, email, name: account.name }, paidPlan));
    }
    return { result: "applied", userId, previous: existing ?? null };
  }

  if (event_name === "subscription_updated") {
    const storedPlan = existing
      ? (getPlanFromIds(existing.variantId, existing.productId) ?? existing.plan)
      : null;
    const result = updateResult(
      await db
        .update(subscription)
        .set({
          status,
          plan,
          billingInterval,
          variantId,
          productId,
          renewsAt: renewsAt ? new Date(renewsAt) : null,
          endsAt: endsAt ? new Date(endsAt) : null,
          pausedUntil,
          cardBrand,
          cardLastFour,
          providerUpdatedAt,
        })
        .where(currentSubscription),
    );

    // An in-place upgrade arrives as an update, not a new subscription.
    if (result === "applied" && storedPlan === "pro" && plan === "ultra" && status === "active") {
      emailOwner((recipient) => sendWelcomeEmail(recipient, "ultra"));
    }
    return { result, userId, previous: existing ?? null };
  }

  if (event_name === "subscription_cancelled") {
    // Keep the plan/variant intact — a cancelled subscription stays entitled
    // until endsAt (see paidPlan in src/lib/billing/entitlements.ts).
    const result = updateResult(
      await db
        .update(subscription)
        .set({
          status,
          endsAt: endsAt ? new Date(endsAt) : null,
          providerUpdatedAt,
        })
        .where(currentSubscription),
    );

    if (result === "applied") {
      emailOwner((recipient) =>
        sendSubscriptionCancelledEmail(recipient, paidPlan, endsAt ? new Date(endsAt) : null),
      );
    }
    return { result, userId, previous: existing ?? null };
  }

  // The row is reset to free here, so the lapse grace (which needs the plan the
  // account had) is recorded in the same transaction: nothing else could
  // recover it from the row afterwards.
  return db.transaction(async (tx) => {
    const result = updateResult(
      await tx
        .update(subscription)
        .set({
          status,
          plan: "free",
          variantId: 0,
          productId: 0,
          endsAt: new Date(), // set endsAt to now to indicate the subscription has ended
          providerUpdatedAt,
        })
        .where(currentSubscription),
    );
    if (result === "applied") {
      await applyBillingEventEntitlements(tx, userId, existing ?? null);
    }
    return { result, userId, previous: existing ?? null };
  });
}

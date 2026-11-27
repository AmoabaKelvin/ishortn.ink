import { and, eq, isNull, lt, or } from "drizzle-orm";

import { getPlanFromIds, isSubscriptionEntitled } from "@/lib/billing/plans";
import { runBackgroundTask } from "@/lib/utils/background";
import { db } from "@/server/db";
import { subscription, user } from "@/server/db/schema";
import { applyBillingEventEntitlements } from "@/server/lib/entitlements/grace";
import {
  sendSubscriptionCancelledEmail,
  sendWelcomeEmail,
} from "@/server/lib/notifications/billing";
import { sendDuplicateSubscriptionAlert } from "@/server/lib/notifications/discord";

import type { Plan } from "@/lib/billing/plans";
import type { Logger } from "@/lib/logger";
import type { Subscription } from "@/server/db/schema";
import type { BillingRecipient } from "@/server/lib/notifications/billing";
import type { MySqlRawQueryResult } from "drizzle-orm/mysql2";

export type BillingProvider = "lemonsqueezy" | "paddle";
export type SubscriptionEventKind = "created" | "updated" | "cancelled" | "expired";

// Lemon Squeezy ids are ints in the original columns; Paddle ids are strings in the provider_*
// columns. Each row holds one provider's ids, and the other's are zeroed or nulled.
type LemonSqueezyIds = {
  provider: "lemonsqueezy";
  subscriptionId: number;
  customerId: number;
  orderId: number;
  variantId: number;
  productId: number;
};

type PaddleIds = {
  provider: "paddle";
  providerSubscriptionId: string;
  providerCustomerId: string;
  providerPriceId: string | null;
};

export type SubscriptionEvent = (LemonSqueezyIds | PaddleIds) & {
  kind: SubscriptionEventKind;
  userId: string;
  status: string;
  plan: Plan;
  billingInterval: "monthly" | "annual";
  renewsAt: Date | null;
  endsAt: Date | null;
  pausedUntil: Date | null;
  createdAt: Date;
  /** Undefined when the event carries no card (Paddle), leaving the stored card as it is. */
  cardBrand: string | null | undefined;
  cardLastFour: string | null | undefined;
  providerUpdatedAt: Date;
};

export type SubscriptionEventResult =
  | "applied"
  | "stale"
  | "superseded"
  | "duplicate_subscription"
  | "no_row_matched"
  | "user_not_found"
  | "invalid_payload";

export type SubscriptionEventOutcome = {
  result: SubscriptionEventResult;
  /** The subscription row before this event, for the entitlement sync. */
  previous?: Subscription | null;
};

export type ApplySubscriptionEventOptions = {
  log: Logger;
  /**
   * Checks the event against the provider's live state when the stored row has no ordering
   * marker yet. Throw when the provider can't be reached so the delivery is retried.
   */
  isBehindProvider?: (providerUpdatedAt: Date) => Promise<boolean>;
  /** Rows this caller must leave alone; the event is acknowledged as `superseded`. */
  isSuperseded?: (existing: Subscription) => boolean;
  /** `created` sends the welcome email unless this is false (an import of an existing plan). */
  sendWelcome?: boolean;
  /**
   * The event activates a subscription (Paddle's `subscription.activated`), so like `created` it
   * is checked for a second live subscription.
   */
  activation?: boolean;
  /** Internal alert for a second live subscription; defaults to the ops Discord webhook. */
  alertDuplicateSubscription?: typeof sendDuplicateSubscriptionAlert;
};

// Paddle statuses (in the app's vocabulary) of a subscription that is billing or will bill again.
const LIVE_PADDLE_STATUSES = new Set(["active", "on_trial", "past_due", "paused"]);

/**
 * Whether the stored row is a different Paddle subscription that is still live. A new one arriving
 * then is a second subscription (a stale checkout paid in another tab), not a replacement.
 */
export function isOtherLiveSubscription(
  existing: Subscription | null | undefined,
  event: SubscriptionEvent,
): existing is Subscription & { providerSubscriptionId: string } {
  return (
    event.provider === "paddle" &&
    existing?.billingProvider === "paddle" &&
    !!existing.providerSubscriptionId &&
    existing.providerSubscriptionId !== event.providerSubscriptionId &&
    LIVE_PADDLE_STATUSES.has(existing.status ?? "")
  );
}

const eventSubscriptionId = (event: SubscriptionEvent) =>
  event.provider === "paddle" ? event.providerSubscriptionId : event.subscriptionId;

const storedSubscriptionId = (row: Subscription) =>
  row.billingProvider === "paddle" ? row.providerSubscriptionId : row.subscriptionId;

/** Applies a subscription event to the user's row, throwing on any failure a retry could fix. */
export async function applySubscriptionEvent(
  event: SubscriptionEvent,
  {
    log,
    isBehindProvider,
    isSuperseded,
    sendWelcome = true,
    activation = false,
    alertDuplicateSubscription = sendDuplicateSubscriptionAlert,
  }: ApplySubscriptionEventOptions,
): Promise<SubscriptionEventOutcome> {
  const { kind, userId, status, plan, endsAt, providerUpdatedAt } = event;
  const subscriptionId = eventSubscriptionId(event);
  const logContext = { provider: event.provider, kind, subscriptionId, userId };

  // A malformed timestamp would poison the ordering marker on a billing row
  // and make every later comparison meaningless, so refuse the delivery.
  if (Number.isNaN(providerUpdatedAt.getTime())) {
    log.error(logContext, "missing or invalid updated_at on subscription payload");
    return { result: "invalid_payload" };
  }

  // Deliveries can arrive out of order or be replayed. Every event must
  // therefore name the subscription it is about and be newer than the event
  // we last applied — otherwise a stale event for a cancelled subscription
  // can revoke the row a newer subscription now owns.
  const existing = await db.query.subscription.findFirst({
    where: eq(subscription.userId, userId),
  });

  if (existing && isSuperseded?.(existing)) {
    log.info(
      { ...logContext, storedProvider: existing.billingProvider },
      "ignoring event for a subscription managed by another provider",
    );
    return { result: "superseded" };
  }

  // Overwriting the row would stop tracking the first subscription while it keeps billing, so the
  // row is kept and the second subscription is left for a person to cancel or refund.
  if ((kind === "created" || activation) && isOtherLiveSubscription(existing, event)) {
    log.error(
      {
        ...logContext,
        storedSubscriptionId: existing.providerSubscriptionId,
        storedStatus: existing.status,
      },
      "second live subscription for user; kept the stored subscription",
    );
    void runBackgroundTask(
      alertDuplicateSubscription({
        userId,
        storedSubscriptionId: existing.providerSubscriptionId,
        storedStatus: existing.status ?? "",
        newSubscriptionId: String(subscriptionId),
        eventType: activation ? "activated" : kind,
      }),
    );
    return { result: "duplicate_subscription", previous: existing };
  }

  // Timestamps from different providers don't order each other: a row from the other provider
  // is replaced by `created` and left alone by every other kind (its ids won't match).
  const sameProvider = existing?.billingProvider === event.provider;
  let isStale = false;

  if (existing && sameProvider && existing.providerUpdatedAt) {
    isStale = existing.providerUpdatedAt >= providerUpdatedAt;
  } else if (existing && sameProvider && isBehindProvider) {
    // A row without a marker accepts the first event it sees, which may be a
    // retry of an old one. Check that event against the provider's current
    // state before letting it become the baseline.
    isStale = await isBehindProvider(providerUpdatedAt);
  }

  // MySQL's ON DUPLICATE KEY UPDATE takes no WHERE clause, and the guarded
  // updates below let a markerless row through, so decide here for every
  // event rather than relying on the predicate.
  if (isStale) {
    log.warn(
      { ...logContext, storedSubscriptionId: existing ? storedSubscriptionId(existing) : null },
      "ignoring event older than stored or provider state",
    );
    return { result: "stale" };
  }

  const currentSubscription = and(
    eq(subscription.userId, userId),
    eq(subscription.billingProvider, event.provider),
    event.provider === "paddle"
      ? eq(subscription.providerSubscriptionId, event.providerSubscriptionId)
      : eq(subscription.subscriptionId, event.subscriptionId),
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
  const updateResult = (result: MySqlRawQueryResult): SubscriptionEventResult => {
    if (result[0]!.affectedRows > 0) return "applied";
    log.warn(
      {
        ...logContext,
        storedSubscriptionId: existing ? storedSubscriptionId(existing) : null,
        reason: !existing
          ? "no subscription row for user"
          : !sameProvider
            ? "subscription row belongs to another provider"
            : storedSubscriptionId(existing) !== subscriptionId
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
          log.error(logContext, "user has no email for billing email");
          return;
        }
        await send({ userId, email: owner.email, name: owner.name });
      })(),
    );
  };

  if (kind === "created") {
    const account = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { email: true, name: true },
    });

    // Not retryable: the account was deleted before the event arrived.
    if (!account) {
      log.error(logContext, "user not found for subscription created event");
      return { result: "user_not_found" };
    }

    if (existing && !sameProvider && isSubscriptionEntitled(existing)) {
      log.warn(
        {
          ...logContext,
          storedProvider: existing.billingProvider,
          storedSubscriptionId: storedSubscriptionId(existing),
          storedStatus: existing.status,
        },
        "replacing a subscription from another provider that still grants access",
      );
    }

    const providerColumns =
      event.provider === "paddle"
        ? {
            billingProvider: event.provider,
            subscriptionId: 0,
            customerId: 0,
            orderId: 0,
            variantId: 0,
            productId: 0,
            providerSubscriptionId: event.providerSubscriptionId,
            providerCustomerId: event.providerCustomerId,
            providerPriceId: event.providerPriceId,
            pausedUntil: event.pausedUntil,
          }
        : {
            billingProvider: event.provider,
            subscriptionId: event.subscriptionId,
            customerId: event.customerId,
            orderId: event.orderId,
            variantId: event.variantId,
            productId: event.productId,
            providerSubscriptionId: null,
            providerCustomerId: null,
            providerPriceId: null,
          };

    // Another provider's card doesn't carry over to this subscription.
    const clearCard = !sameProvider && event.cardBrand === undefined;

    // A returning customer already has a row, so refresh the full
    // subscription state — not just status/dates — or their plan,
    // interval, and subscriptionId would stay stale.
    const state = {
      ...providerColumns,
      status,
      plan,
      billingInterval: event.billingInterval,
      cardBrand: clearCard ? null : event.cardBrand,
      cardLastFour: clearCard ? null : event.cardLastFour,
      renewsAt: event.renewsAt,
      endsAt,
      providerUpdatedAt,
    };

    await db
      .insert(subscription)
      .values({ ...state, userId, createdAt: event.createdAt })
      .onDuplicateKeyUpdate({ set: state });

    if (sendWelcome && !account.email) {
      log.error(logContext, "user has no email for welcome");
    } else if (sendWelcome && account.email) {
      void runBackgroundTask(
        sendWelcomeEmail({ userId, email: account.email, name: account.name }, paidPlan),
      );
    }
    return { result: "applied", previous: existing ?? null };
  }

  if (kind === "updated") {
    const storedPlan = existing
      ? (getPlanFromIds(existing.variantId, existing.productId) ?? existing.plan)
      : null;
    const result = updateResult(
      await db
        .update(subscription)
        .set({
          ...(event.provider === "paddle"
            ? { providerPriceId: event.providerPriceId }
            : { variantId: event.variantId, productId: event.productId }),
          status,
          plan,
          billingInterval: event.billingInterval,
          renewsAt: event.renewsAt,
          endsAt,
          pausedUntil: event.pausedUntil,
          cardBrand: event.cardBrand,
          cardLastFour: event.cardLastFour,
          providerUpdatedAt,
        })
        .where(currentSubscription),
    );

    // An in-place upgrade arrives as an update, not a new subscription.
    if (result === "applied" && storedPlan === "pro" && plan === "ultra" && status === "active") {
      emailOwner((recipient) => sendWelcomeEmail(recipient, "ultra"));
    }
    return { result, previous: existing ?? null };
  }

  if (kind === "cancelled") {
    // Keep the plan/variant intact — a cancelled subscription stays entitled
    // until endsAt (see paidPlan in src/lib/billing/entitlements.ts).
    const result = updateResult(
      await db
        .update(subscription)
        .set({ status, endsAt, providerUpdatedAt })
        .where(currentSubscription),
    );

    // Paddle repeats the cancelled state on every later update until the period ends; only the
    // transition into it is a cancellation.
    if (result === "applied" && existing?.status !== "cancelled") {
      emailOwner((recipient) => sendSubscriptionCancelledEmail(recipient, paidPlan, endsAt));
    }
    return { result, previous: existing ?? null };
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
    return { result, previous: existing ?? null };
  });
}

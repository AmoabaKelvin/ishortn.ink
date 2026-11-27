import {
  cancelSubscription,
  createCheckout,
  getCustomer,
  getSubscription,
  updateSubscription,
} from "@lemonsqueezy/lemonsqueezy.js";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, lt, or } from "drizzle-orm";

import { env } from "@/env.mjs";
import { checkoutCustomData, checkoutEventProperties } from "@/lib/billing/attribution";
import {
  canOfferPause,
  getIntervalFromVariantId,
  getPlanFromIds,
  getSubscriptionMode,
  getVariantId,
  pauseResumesAt,
  resolvePlan,
  subscriptionInterval,
} from "@/lib/billing/plans";
import { checkoutDiscountCode } from "@/lib/billing/promo";
import { configureLemonSqueezy } from "@/lib/config/lemonsqueezy";
import { logger } from "@/lib/logger";
import { getPaddleClient, PaddleApiError } from "@/lib/paddle/client";
import { checkoutProviderFor, getPaddleConfig, paddlePriceId } from "@/lib/paddle/config";
import { normalizePaddleSubscription, paddleSubscriptionSchema } from "@/lib/paddle/normalize";
import { runBackgroundTask } from "@/lib/utils/background";
import { subscription, subscriptionCancellation } from "@/server/db/schema";
import { captureServerEvent } from "@/server/lib/analytics/posthog-server";
import { recordCheckoutStart } from "@/server/lib/checkout-starts";
import { sendDowngradeFeedbackNotification } from "@/server/lib/notifications/discord";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  createCheckoutOrUpdateInput,
  downgradeReasonLabels,
  downgradeWithFeedbackInput,
  pauseSubscriptionInput,
} from "./lemonsqueezy.input";
import { createPaddleCheckout } from "./paddle-checkout";
import {
  createCheckoutWithPromoFallback,
  lemonSqueezyPromoRejected,
  paddleErrorToClient,
  parseProviderUpdatedAt,
  pauseUpdate,
  providerErrorToClient,
  resumeUpdate,
} from "./utils";

import type { ProtectedTRPCContext } from "../../trpc";
import type { CreateCheckoutOrUpdateInput } from "./lemonsqueezy.input";
import type { PaddleCheckoutClient } from "./paddle-checkout";
import type { Attribution } from "@/lib/billing/attribution";
import type { BillingInterval, Plan } from "@/lib/billing/plans";
import type { PaddleClient, PaddleSubscription } from "@/lib/paddle/client";
import type { PaddleConfig, PaidPlan } from "@/lib/paddle/config";
import type { NormalizedPaddleSubscription } from "@/lib/paddle/normalize";
import type { Subscription } from "@/server/db/schema";
import type { CheckoutStartInput } from "@/server/lib/checkout-starts";
import type { Subscription as ProviderSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import type { SQL } from "drizzle-orm";

const log = logger.child({ component: "billing.lemonsqueezy" });

const resumeFirstMessage = (status: string | null | undefined) =>
  `Your subscription is ${status === "paused" ? "paused" : "cancelled"}. Resume it before changing plans.`;

type ProviderErrorContext = {
  userId: string;
  subscriptionId?: number;
  variantId?: number;
};

function providerError(
  action: string,
  result: { error: Error; statusCode: number | null },
  context: ProviderErrorContext,
): TRPCError {
  log.error(
    { err: result.error, statusCode: result.statusCode, ...context },
    `lemon squeezy ${action} failed`,
  );
  return new TRPCError(providerErrorToClient(result.statusCode));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

type SubscriptionUpdate = Partial<typeof subscription.$inferInsert>;

type ProviderState = Pick<SubscriptionUpdate, "status" | "endsAt" | "renewsAt" | "pausedUntil"> & {
  providerUpdatedAt: Date | null;
};

/**
 * Mirrors the provider's state onto the local row right after a change. The
 * provider's `updated_at` becomes the ordering marker, so the webhook for this
 * same change, or an older one delivered late, is dropped instead of reverting
 * it; a newer webhook that already landed is not overwritten.
 */
async function writeProviderState(
  ctx: ProtectedTRPCContext,
  matchesSubscription: SQL[],
  { providerUpdatedAt, ...state }: ProviderState,
  extra: SubscriptionUpdate,
) {
  await ctx.db
    .update(subscription)
    .set({ ...extra, ...state, ...(providerUpdatedAt && { providerUpdatedAt }) })
    .where(
      and(
        eq(subscription.userId, ctx.auth.userId),
        ...matchesSubscription,
        providerUpdatedAt
          ? or(
              isNull(subscription.providerUpdatedAt),
              lt(subscription.providerUpdatedAt, providerUpdatedAt),
            )
          : undefined,
      ),
    );
}

async function applyProviderState(
  ctx: ProtectedTRPCContext,
  subscriptionId: number,
  attributes: ProviderSubscription["data"]["attributes"],
  extra: SubscriptionUpdate = {},
) {
  await writeProviderState(
    ctx,
    [eq(subscription.subscriptionId, subscriptionId)],
    {
      status: attributes.status,
      endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
      renewsAt: attributes.renews_at ? new Date(attributes.renews_at) : null,
      pausedUntil: attributes.pause?.resumes_at ? new Date(attributes.pause.resumes_at) : null,
      providerUpdatedAt: parseProviderUpdatedAt(attributes.updated_at),
    },
    extra,
  );
}

export type PaddleDeps = {
  client: Pick<
    PaddleClient,
    | "getSubscription"
    | "updateSubscription"
    | "cancelSubscription"
    | "pauseSubscription"
    | "resumeSubscription"
    | "getUpdatePaymentMethodTransaction"
    | "createPortalSession"
  >;
  config: PaddleConfig;
};

export type BillingDeps = {
  /** The Paddle client and config, or null while Paddle isn't configured. */
  paddle: () => PaddleDeps | null;
};

const defaultBillingDeps: BillingDeps = {
  paddle: () => {
    const config = getPaddleConfig();
    const client = getPaddleClient();
    return config && client ? { config, client } : null;
  },
};

type PaddleRow = Subscription & { providerSubscriptionId: string };

function isPaddleRow(row: Subscription | null | undefined): row is PaddleRow {
  return row?.billingProvider === "paddle" && !!row.providerSubscriptionId;
}

/** Runs a Paddle call, logging a failure and turning it into a user-facing error. */
async function callPaddle<T>(
  action: string,
  context: { userId: string; providerSubscriptionId: string },
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call();
  } catch (err) {
    const statusCode = err instanceof PaddleApiError ? err.status : null;
    log.error({ err, statusCode, provider: "paddle", ...context }, `paddle ${action} failed`);
    throw new TRPCError(paddleErrorToClient(statusCode));
  }
}

function requirePaddle(deps: BillingDeps, userId: string): PaddleDeps {
  const paddle = deps.paddle();
  if (!paddle) {
    log.error(
      { userId, provider: "paddle" },
      "paddle subscription found but paddle is not configured",
    );
    throw new TRPCError(providerErrorToClient(null));
  }
  return paddle;
}

// Paddle refuses item changes on a past_due subscription.
function assertPaddleItemsChangeable(row: PaddleRow) {
  if (row.status === "past_due") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Update your payment method first." });
  }
}

/** Paddle's counterpart of applyProviderState, matched on the Paddle subscription id. */
async function applyPaddleState(
  ctx: ProtectedTRPCContext,
  config: PaddleConfig,
  paddleSubscription: PaddleSubscription,
  extra: (normalized: NormalizedPaddleSubscription) => SubscriptionUpdate = () => ({}),
): Promise<NormalizedPaddleSubscription> {
  const normalized = normalizePaddleSubscription(
    paddleSubscriptionSchema.parse(paddleSubscription),
    config,
  );
  await writeProviderState(
    ctx,
    [
      eq(subscription.billingProvider, "paddle"),
      eq(subscription.providerSubscriptionId, normalized.providerSubscriptionId),
    ],
    {
      status: normalized.status,
      endsAt: normalized.endsAt,
      renewsAt: normalized.renewsAt,
      pausedUntil: normalized.pausedUntil,
      providerUpdatedAt: normalized.providerUpdatedAt,
    },
    extra(normalized),
  );
  return normalized;
}

/** The plan fields to store after a Paddle plan change; the requested plan when the price is unknown. */
const paddlePlanFields =
  (plan: PaidPlan, interval: BillingInterval) => (normalized: NormalizedPaddleSubscription) => ({
    plan: normalized.unrecognisedPrice ? plan : normalized.plan,
    billingInterval: normalized.unrecognisedPrice ? interval : normalized.interval,
    providerPriceId: normalized.providerPriceId,
  });

async function paddlePortalUrls(
  { client }: PaddleDeps,
  row: PaddleRow,
  userId: string,
): Promise<{ customer_portal: string; update_payment_method: string | null } | null> {
  if (!row.providerCustomerId) return null;
  const customerId = row.providerCustomerId;
  const session = await callPaddle(
    "portal session",
    { userId, providerSubscriptionId: row.providerSubscriptionId },
    () => client.createPortalSession(customerId, [row.providerSubscriptionId]),
  );
  return {
    customer_portal: session.urls.general.overview,
    update_payment_method:
      session.urls.subscriptions[0]?.update_subscription_payment_method ?? null,
  };
}

type CancellationRecord = Pick<
  typeof subscriptionCancellation.$inferInsert,
  "toPlan" | "reason" | "feedback" | "offerShown" | "outcome" | "pauseMonths"
>;

/** Logged rather than thrown: the provider has already applied the change by now. */
async function recordCancellation(
  ctx: ProtectedTRPCContext,
  userSubscription: Subscription,
  fromPlan: Plan,
  record: CancellationRecord,
) {
  try {
    await ctx.db.insert(subscriptionCancellation).values({
      userId: ctx.auth.userId,
      // Paddle ids are strings; they go in providerSubscriptionId.
      subscriptionId:
        userSubscription.billingProvider === "paddle" ? 0 : (userSubscription.subscriptionId ?? 0),
      fromPlan,
      providerSubscriptionId: userSubscription.providerSubscriptionId,
      billingInterval: subscriptionInterval(userSubscription),
      variantId: userSubscription.variantId,
      ...record,
    });
  } catch (err) {
    log.error(
      { err, userId: ctx.auth.userId, outcome: record.outcome },
      "failed to record subscription cancellation",
    );
  }
}

async function getUserSubscription(ctx: ProtectedTRPCContext) {
  return ctx.db.query.subscription.findFirst({
    where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
  });
}

export type NewCheckoutDeps = {
  recordStart: (start: CheckoutStartInput) => Promise<void>;
  paddleConfig: PaddleConfig | null;
  paddleClient: PaddleCheckoutClient | null;
  createLemonSqueezyCheckout: typeof createCheckout;
  /** Runs before a Lemon Squeezy checkout only, so a Paddle checkout works without its env. */
  configureLemonSqueezy: () => void;
};

export type NewCheckoutInput = CreateCheckoutOrUpdateInput & {
  userId: string;
  user: { email: string | null } | null | undefined;
  subscription: Subscription | null | undefined;
};

async function lemonSqueezyCheckout(
  deps: NewCheckoutDeps,
  input: NewCheckoutInput,
  attribution: Attribution,
  promoCode: string | undefined,
) {
  deps.configureLemonSqueezy();
  const { userId } = input;
  const variantId = getVariantId(input.plan, input.interval);
  const { result: checkout, discountCode } = await createCheckoutWithPromoFallback(
    (discountCode) =>
      deps.createLemonSqueezyCheckout(env.LEMONSQUEEZY_STORE_ID!, variantId, {
        checkoutOptions: {
          // The app opens the URL as a full page; an embed checkout's close button only works
          // inside the Lemon.js overlay.
          embed: false,
          media: false,
        },
        checkoutData: {
          email: input.user?.email ?? undefined,
          discountCode,
          // Read back by the order webhook to attribute the order like the checkout.
          custom: checkoutCustomData(userId, attribution, discountCode),
        },
        productOptions: {
          enabledVariants: [variantId],
          // The flag opens the "how did you find us" prompt (checkout-acquisition-prompt.tsx).
          redirectUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings?checkout=success#billing`,
          receiptButtonText: "Go to Dashboard",
          receiptThankYouNote: `Thank you for signing up to iShortn ${
            input.plan.charAt(0).toUpperCase() + input.plan.slice(1)
          }!`,
        },
      }),
    lemonSqueezyPromoRejected,
    promoCode,
    (rejected) =>
      log.warn(
        { userId, variantId, discountCode: promoCode, err: rejected.error },
        "promo code rejected, retrying checkout without it",
      ),
  );

  if (checkout.error) {
    throw providerError("checkout", checkout, { userId, variantId });
  }

  const url = checkout.data.data.attributes.url;
  if (!url) {
    log.error({ userId, variantId }, "lemon squeezy checkout returned no url");
    throw new TRPCError(providerErrorToClient(null));
  }
  return { url, discountCode };
}

/**
 * A checkout for a user with no subscription to change: Paddle when the provider switch selects
 * it for this user (`checkoutProviderFor`), Lemon Squeezy otherwise.
 */
export async function startNewCheckout(deps: NewCheckoutDeps, input: NewCheckoutInput) {
  const { userId, plan, interval } = input;
  // A subscription that still exists with either provider is changed or resumed in place; a
  // second checkout would bill twice while only one row is kept.
  if (getSubscriptionMode(input.subscription) !== "checkout") {
    log.error(
      { userId, provider: input.subscription?.billingProvider },
      "refused a new checkout for a user with a live subscription",
    );
    throw new TRPCError({
      code: "CONFLICT",
      message: "You already have a subscription. Change your plan from billing settings.",
    });
  }
  const promoCode = checkoutDiscountCode();
  const attribution = { source: input.source, ...input.utm };
  const priceId = paddlePriceId(plan, interval, deps.paddleConfig);
  // Configured Paddle always has a client and every price; the checks only narrow the types.
  const paddle =
    checkoutProviderFor(userId, deps.paddleConfig) === "paddle" && deps.paddleClient && priceId
      ? { client: deps.paddleClient, priceId }
      : null;
  const provider = paddle ? "paddle" : "lemonsqueezy";

  const { url, discountCode } = paddle
    ? await createPaddleCheckout(paddle.client, {
        userId,
        email: input.user?.email,
        subscription: input.subscription,
        plan,
        interval,
        priceId: paddle.priceId,
        attribution,
        promoCode,
      })
    : await lemonSqueezyCheckout(deps, input, attribution, promoCode);

  void runBackgroundTask(
    deps.recordStart({
      userId,
      plan,
      interval,
      source: input.source ?? null,
      promoCode: discountCode ?? null,
      provider,
    }),
  );

  captureServerEvent(
    { id: userId, email: input.user?.email },
    "checkout_started",
    checkoutEventProperties({
      plan,
      interval,
      discount_code: discountCode,
      provider,
      ...attribution,
    }),
  );

  return { status: "redirect" as const, url };
}

export const createLemonsqueezyRouter = (deps: BillingDeps = defaultBillingDeps) =>
  createTRPCRouter({
    createCheckoutOrUpdate: protectedProcedure
      .input(createCheckoutOrUpdateInput)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.auth.userId;
        const variantId = getVariantId(input.plan, input.interval);

        const [user, userSubscription] = await Promise.all([
          ctx.db.query.user.findFirst({ where: (table, { eq }) => eq(table.id, userId) }),
          getUserSubscription(ctx),
        ]);

        // Any subscription that still grants access is changed or resumed, never
        // replaced: a second checkout would create a second subscription that
        // keeps billing after the webhook overwrites the single local row.
        const mode = getSubscriptionMode(userSubscription);

        if (mode === "resume") {
          throw new TRPCError({
            code: "CONFLICT",
            message: resumeFirstMessage(userSubscription?.status),
          });
        }

        if (mode === "update" && isPaddleRow(userSubscription)) {
          const { client, config } = requirePaddle(deps, userId);
          const providerSubscriptionId = userSubscription.providerSubscriptionId;
          assertPaddleItemsChangeable(userSubscription);

          const priceId = paddlePriceId(input.plan, input.interval, config);
          if (!priceId) throw new TRPCError(providerErrorToClient(null));
          if (userSubscription.providerPriceId === priceId) {
            return { status: "updated" as const, message: "You are already on this plan." };
          }

          const updatedSub = await callPaddle(
            "plan change",
            { userId, providerSubscriptionId },
            () =>
              client.updateSubscription(providerSubscriptionId, {
                items: [{ priceId, quantity: 1 }],
                prorationBillingMode: "prorated_immediately",
              }),
          );

          try {
            await applyPaddleState(
              ctx,
              config,
              updatedSub,
              paddlePlanFields(input.plan, input.interval),
            );
          } catch (e) {
            // Paddle already applied the change; the webhook will sync it.
            log.error(
              { err: e, userId, providerSubscriptionId, provider: "paddle" },
              "failed to update local subscription state",
            );
          }

          return { status: "updated" as const, message: "Plan updated successfully!" };
        }

        if (mode === "update" && userSubscription?.subscriptionId) {
          const subscriptionId = userSubscription.subscriptionId;

          if (userSubscription.variantId === variantId) {
            return { status: "updated" as const, message: "You are already on this plan." };
          }

          configureLemonSqueezy();

          const updatedSub = await updateSubscription(subscriptionId, {
            variantId,
            invoiceImmediately: true,
          });

          if (updatedSub.error) {
            throw providerError("plan change", updatedSub, { userId, subscriptionId, variantId });
          }

          const attributes = updatedSub.data.data.attributes;
          try {
            await applyProviderState(ctx, subscriptionId, attributes, {
              plan: getPlanFromIds(attributes.variant_id, attributes.product_id) ?? input.plan,
              billingInterval: getIntervalFromVariantId(attributes.variant_id),
              variantId: attributes.variant_id,
              productId: attributes.product_id,
            });
          } catch (e) {
            // The provider already applied the change; the webhook will sync it.
            log.error(
              { err: e, userId, subscriptionId },
              "failed to update local subscription state",
            );
          }

          return { status: "updated" as const, message: "Plan updated successfully!" };
        }

        return startNewCheckout(
          {
            recordStart: (start) => recordCheckoutStart(start, ctx.db),
            paddleConfig: getPaddleConfig(),
            paddleClient: getPaddleClient(),
            createLemonSqueezyCheckout: createCheckout,
            configureLemonSqueezy,
          },
          { userId, user, subscription: userSubscription, ...input },
        );
      }),

    cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
      const userId = ctx.auth.userId;
      const userSubscription = await getUserSubscription(ctx);
      const mode = getSubscriptionMode(userSubscription);

      if (mode === "resume") {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            userSubscription?.status === "paused"
              ? resumeFirstMessage("paused")
              : "Your subscription is already cancelled.",
        });
      }
      if (isPaddleRow(userSubscription) && mode === "update") {
        const { client, config } = requirePaddle(deps, userId);
        const providerSubscriptionId = userSubscription.providerSubscriptionId;
        const cancelledSub = await callPaddle("cancel", { userId, providerSubscriptionId }, () =>
          client.cancelSubscription(providerSubscriptionId, "next_billing_period"),
        );
        await applyPaddleState(ctx, config, cancelledSub);
        return cancelledSub;
      }
      if (mode !== "update" || !userSubscription?.subscriptionId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No active subscription found" });
      }

      const subscriptionId = userSubscription.subscriptionId;
      configureLemonSqueezy();
      const cancelledSub = await cancelSubscription(subscriptionId);

      if (cancelledSub.error) {
        throw providerError("cancel", cancelledSub, { userId, subscriptionId });
      }

      // Keep plan/variant: access is retained until endsAt, and resolvePlan()
      // drops the user to free once that date passes.
      await applyProviderState(ctx, subscriptionId, cancelledSub.data.data.attributes);

      return cancelledSub;
    }),

    resumeSubscription: protectedProcedure.mutation(async ({ ctx }) => {
      const userId = ctx.auth.userId;
      const userSubscription = await getUserSubscription(ctx);

      const mode = getSubscriptionMode(userSubscription);

      if (mode === "resume" && isPaddleRow(userSubscription)) {
        const { client, config } = requirePaddle(deps, userId);
        const providerSubscriptionId = userSubscription.providerSubscriptionId;
        // A pause in effect is resumed; a scheduled cancel or pause is removed.
        const resumedSub = await callPaddle("resume", { userId, providerSubscriptionId }, () =>
          userSubscription.status === "paused"
            ? client.resumeSubscription(providerSubscriptionId, "immediately")
            : client.updateSubscription(providerSubscriptionId, { scheduledChange: null }),
        );
        await applyPaddleState(ctx, config, resumedSub);
        return { message: "Your subscription has been resumed." };
      }
      if (mode !== "resume" || !userSubscription?.subscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There is no cancelled or paused subscription to resume.",
        });
      }

      const subscriptionId = userSubscription.subscriptionId;
      configureLemonSqueezy();
      const resumedSub = await updateSubscription(
        subscriptionId,
        resumeUpdate(userSubscription.status),
      );

      if (resumedSub.error) {
        throw providerError("resume", resumedSub, { userId, subscriptionId });
      }

      await applyProviderState(ctx, subscriptionId, resumedSub.data.data.attributes);

      return { message: "Your subscription has been resumed." };
    }),

    subscriptionDetails: protectedProcedure.mutation(async ({ ctx }) => {
      const userId = ctx.auth.userId;
      const userSubscription = await getUserSubscription(ctx);

      if (!userSubscription) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No subscription found." });
      }

      if (isPaddleRow(userSubscription)) {
        const urls = await paddlePortalUrls(requirePaddle(deps, userId), userSubscription, userId);
        if (urls) return urls;
        log.error(
          {
            userId,
            provider: "paddle",
            providerSubscriptionId: userSubscription.providerSubscriptionId,
          },
          "paddle subscription has no customer id for a portal session",
        );
        throw new TRPCError(providerErrorToClient(null));
      }

      configureLemonSqueezy();

      // Try to get subscription details if we have a valid subscriptionId
      if (userSubscription.subscriptionId && userSubscription.subscriptionId > 0) {
        const userSub = await getSubscription(userSubscription.subscriptionId);

        if (!userSub.error) {
          return userSub.data.data.attributes.urls;
        }
      }

      // Fall back to customer portal if we have a valid customerId
      if (userSubscription.customerId && userSubscription.customerId > 0) {
        const customer = await getCustomer(userSubscription.customerId);

        if (!customer.error && customer.data.data.attributes.urls.customer_portal) {
          return {
            customer_portal: customer.data.data.attributes.urls.customer_portal,
            update_payment_method: null,
          };
        }
      }

      log.error({ userId }, "lemon squeezy returned no portal url");
      throw new TRPCError(providerErrorToClient(null));
    }),

    // The checkout that created the current subscription, for its discount (subscriptionDiscount).
    latestCheckoutStart: protectedProcedure.query(async ({ ctx }) => {
      const start = await ctx.db.query.checkoutStart.findFirst({
        where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
        orderBy: (table, { desc }) => [desc(table.createdAt), desc(table.id)],
        columns: { plan: true, interval: true, promoCode: true, provider: true, createdAt: true },
      });
      return start ?? null;
    }),

    // The subscription's update-payment-method page. Lemon Squeezy signs this URL
    // and it expires, so it is fetched fresh on every visit instead of stored.
    // Falls back to the customer portal like subscriptionDetails (Settings →
    // Billing); null when neither is available.
    updatePaymentMethodUrl: protectedProcedure.query(async ({ ctx }) => {
      const userSubscription = await getUserSubscription(ctx);

      if (isPaddleRow(userSubscription)) {
        const userId = ctx.auth.userId;
        const providerSubscriptionId = userSubscription.providerSubscriptionId;
        try {
          const paddle = requirePaddle(deps, userId);
          const urls = await paddlePortalUrls(paddle, userSubscription, userId).catch(() => null);
          if (urls?.update_payment_method) return urls.update_payment_method;
          const transaction =
            await paddle.client.getUpdatePaymentMethodTransaction(providerSubscriptionId);
          return transaction.checkout?.url ?? null;
        } catch (err) {
          log.error(
            { err, userId, providerSubscriptionId, provider: "paddle" },
            "failed to fetch payment management url",
          );
          return null;
        }
      }

      const subscriptionId = userSubscription?.subscriptionId;
      const customerId = userSubscription?.customerId;

      try {
        configureLemonSqueezy();
        if (subscriptionId && subscriptionId > 0) {
          const providerSub = await getSubscription(subscriptionId);
          const url = providerSub.data?.data.attributes.urls.update_payment_method;
          if (url) return url;
          if (providerSub.error) {
            log.warn(
              { err: providerSub.error, userId: ctx.auth.userId, subscriptionId },
              "failed to fetch update-payment-method url; trying customer portal",
            );
          }
        }
        if (customerId && customerId > 0) {
          const customer = await getCustomer(customerId);
          if (customer.error) throw customer.error;
          return customer.data.data.attributes.urls.customer_portal ?? null;
        }
        return null;
      } catch (err) {
        log.error(
          { err, userId: ctx.auth.userId, subscriptionId, customerId },
          "failed to fetch payment management url",
        );
        return null;
      }
    }),

    downgradeWithFeedback: protectedProcedure
      .input(downgradeWithFeedbackInput)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.auth.userId;
        const { targetPlan, reason, additionalFeedback } = input;

        const [userRecord, userSubscription] = await Promise.all([
          ctx.db.query.user.findFirst({ where: (table, { eq }) => eq(table.id, userId) }),
          getUserSubscription(ctx),
        ]);

        const mode = getSubscriptionMode(userSubscription);

        if (mode === "resume") {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              targetPlan === "free" && userSubscription?.status !== "paused"
                ? "Your subscription is already cancelled."
                : resumeFirstMessage(userSubscription?.status),
          });
        }
        const paddleRow = isPaddleRow(userSubscription) ? userSubscription : null;
        if (
          mode !== "update" ||
          !userSubscription ||
          (!paddleRow && !userSubscription.subscriptionId)
        ) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No active subscription found" });
        }

        const subscriptionId = userSubscription.subscriptionId ?? 0;
        const currentPlan = resolvePlan(userSubscription);

        // Validate this is actually a downgrade
        const planOrder = { free: 0, pro: 1, ultra: 2 };
        if (planOrder[targetPlan] >= planOrder[currentPlan]) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid downgrade request - target plan is not lower than current plan",
          });
        }
        const paddle = paddleRow ? requirePaddle(deps, userId) : null;
        if (paddleRow && targetPlan !== "free") assertPaddleItemsChangeable(paddleRow);
        if (!paddleRow) configureLemonSqueezy();

        const cancellation = {
          toPlan: targetPlan,
          reason,
          feedback: additionalFeedback || null,
          // The modal offers a pause before every cancellation canOfferPause allows.
          offerShown: targetPlan === "free" && canOfferPause(userSubscription) ? "pause" : "none",
        } as const;

        // Send feedback notification (fire and forget — waitUntil keeps the
        // Worker alive until the Discord webhook completes).
        void runBackgroundTask(
          sendDowngradeFeedbackNotification({
            userEmail: userRecord?.email ?? "unknown",
            userName: userRecord?.name,
            fromPlan: currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1),
            toPlan: targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1),
            reason: downgradeReasonLabels[reason],
            additionalFeedback,
          }),
        );

        // Handle downgrade to free (cancellation)
        if (targetPlan === "free") {
          // Keep plan/variant: access is retained until endsAt, and
          // resolvePlan() drops the user to free once that date passes.
          let endsAt: Date | null;
          if (paddleRow && paddle) {
            const providerSubscriptionId = paddleRow.providerSubscriptionId;
            const cancelledSub = await callPaddle(
              "cancel",
              { userId, providerSubscriptionId },
              () => paddle.client.cancelSubscription(providerSubscriptionId, "next_billing_period"),
            );
            ({ endsAt } = await applyPaddleState(ctx, paddle.config, cancelledSub));
          } else {
            const cancelledSub = await cancelSubscription(subscriptionId);

            if (cancelledSub.error) {
              throw providerError("cancel", cancelledSub, { userId, subscriptionId });
            }

            const attributes = cancelledSub.data.data.attributes;
            await applyProviderState(ctx, subscriptionId, attributes);
            endsAt = attributes.ends_at ? new Date(attributes.ends_at) : null;
          }
          await recordCancellation(ctx, userSubscription, currentPlan, {
            ...cancellation,
            outcome: "cancelled",
          });

          return {
            status: "cancelled" as const,
            message: endsAt
              ? `Your subscription has been cancelled. You'll keep access until ${formatDate(endsAt)}.`
              : "Your subscription has been cancelled. You'll keep access until the end of your billing period.",
          };
        }

        // Downgrade to Pro (from Ultra), keeping the current interval. Both
        // providers switch the plan now and credit the unused time on the next
        // invoice, so the plan changes now.
        const interval = subscriptionInterval(userSubscription);

        if (paddleRow && paddle) {
          const providerSubscriptionId = paddleRow.providerSubscriptionId;
          const priceId = paddlePriceId(targetPlan, interval, paddle.config);
          if (!priceId) throw new TRPCError(providerErrorToClient(null));

          const updatedSub = await callPaddle("downgrade", { userId, providerSubscriptionId }, () =>
            paddle.client.updateSubscription(providerSubscriptionId, {
              items: [{ priceId, quantity: 1 }],
              prorationBillingMode: "prorated_next_billing_period",
            }),
          );
          await applyPaddleState(
            ctx,
            paddle.config,
            updatedSub,
            paddlePlanFields(targetPlan, interval),
          );
        } else {
          const variantId = getVariantId(targetPlan, interval);

          const updatedSub = await updateSubscription(subscriptionId, {
            variantId,
            invoiceImmediately: false,
          });

          if (updatedSub.error) {
            throw providerError("downgrade", updatedSub, { userId, subscriptionId, variantId });
          }

          const attributes = updatedSub.data.data.attributes;
          await applyProviderState(ctx, subscriptionId, attributes, {
            plan: targetPlan,
            billingInterval: interval,
            variantId: attributes.variant_id,
            productId: attributes.product_id,
          });
        }
        await recordCancellation(ctx, userSubscription, currentPlan, {
          ...cancellation,
          outcome: "downgraded",
        });

        return {
          status: "downgraded" as const,
          message: "You're now on Pro. Credit for unused Ultra time goes toward your next invoice.",
        };
      }),

    // Offered in place of cancelling to Free (downgrade-feedback-modal.tsx).
    pauseSubscription: protectedProcedure
      .input(pauseSubscriptionInput)
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.auth.userId;
        const [userRecord, userSubscription] = await Promise.all([
          ctx.db.query.user.findFirst({ where: (table, { eq }) => eq(table.id, userId) }),
          getUserSubscription(ctx),
        ]);

        if (!userSubscription || !canOfferPause(userSubscription)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only an active monthly subscription can be paused.",
          });
        }

        const currentPlan = resolvePlan(userSubscription);
        let restartsAt: Date;

        if (isPaddleRow(userSubscription)) {
          const { client, config } = requirePaddle(deps, userId);
          const providerSubscriptionId = userSubscription.providerSubscriptionId;
          const context = { userId, providerSubscriptionId };
          // Paddle pauses at the end of the paid period, so the paused months count from there.
          const current = await callPaddle("pause", context, () =>
            client.getSubscription(providerSubscriptionId),
          );
          const periodEnd = current.current_billing_period?.ends_at;
          const resumesAt = pauseResumesAt(
            input.months,
            periodEnd ? new Date(periodEnd) : new Date(),
          );

          const pausedSub = await callPaddle("pause", context, () =>
            client.pauseSubscription(providerSubscriptionId, {
              effectiveFrom: "next_billing_period",
              resumeAt: resumesAt.toISOString(),
            }),
          );
          const normalized = await applyPaddleState(ctx, config, pausedSub);
          restartsAt = normalized.pausedUntil ?? resumesAt;
        } else {
          const subscriptionId = userSubscription.subscriptionId ?? 0;
          const resumesAt = pauseResumesAt(input.months);
          configureLemonSqueezy();

          const pausedSub = await updateSubscription(subscriptionId, pauseUpdate(resumesAt));
          if (pausedSub.error) {
            throw providerError("pause", pausedSub, { userId, subscriptionId });
          }

          const attributes = pausedSub.data.data.attributes;
          await applyProviderState(ctx, subscriptionId, attributes);
          restartsAt = attributes.pause?.resumes_at
            ? new Date(attributes.pause.resumes_at)
            : resumesAt;
        }

        await recordCancellation(ctx, userSubscription, currentPlan, {
          toPlan: "free",
          reason: input.reason,
          feedback: input.feedback || null,
          offerShown: "pause",
          outcome: "paused",
          pauseMonths: input.months,
        });

        void runBackgroundTask(
          sendDowngradeFeedbackNotification({
            userEmail: userRecord?.email ?? "unknown",
            userName: userRecord?.name,
            fromPlan: currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1),
            toPlan: `Paused for ${input.months} ${input.months === 1 ? "month" : "months"}`,
            reason: downgradeReasonLabels[input.reason],
            additionalFeedback: input.feedback,
          }),
        );

        return {
          message: `Billing is paused. It restarts on ${formatDate(restartsAt)}.`,
        };
      }),
  });

export const lemonsqueezyRouter = createLemonsqueezyRouter();

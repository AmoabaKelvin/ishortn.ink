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
import {
  createCheckoutWithPromoFallback,
  parseProviderUpdatedAt,
  pauseUpdate,
  providerErrorToClient,
  resumeUpdate,
} from "./utils";

import type { ProtectedTRPCContext } from "../../trpc";
import type { Plan } from "@/lib/billing/plans";
import type { Subscription } from "@/server/db/schema";
import type { Subscription as ProviderSubscription } from "@lemonsqueezy/lemonsqueezy.js";

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

/**
 * Mirrors the provider's state onto the local row right after a change. The
 * provider's `updated_at` becomes the ordering marker, so the webhook for this
 * same change, or an older one delivered late, is dropped instead of reverting
 * it; a newer webhook that already landed is not overwritten.
 */
async function applyProviderState(
  ctx: ProtectedTRPCContext,
  subscriptionId: number,
  attributes: ProviderSubscription["data"]["attributes"],
  extra: Partial<typeof subscription.$inferInsert> = {},
) {
  const providerUpdatedAt = parseProviderUpdatedAt(attributes.updated_at);

  await ctx.db
    .update(subscription)
    .set({
      ...extra,
      status: attributes.status,
      endsAt: attributes.ends_at ? new Date(attributes.ends_at) : null,
      renewsAt: attributes.renews_at ? new Date(attributes.renews_at) : null,
      pausedUntil: attributes.pause?.resumes_at ? new Date(attributes.pause.resumes_at) : null,
      ...(providerUpdatedAt && { providerUpdatedAt }),
    })
    .where(
      and(
        eq(subscription.userId, ctx.auth.userId),
        eq(subscription.subscriptionId, subscriptionId),
        providerUpdatedAt
          ? or(
              isNull(subscription.providerUpdatedAt),
              lt(subscription.providerUpdatedAt, providerUpdatedAt),
            )
          : undefined,
      ),
    );
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
      subscriptionId: userSubscription.subscriptionId ?? 0,
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

export const lemonsqueezyRouter = createTRPCRouter({
  createCheckoutOrUpdate: protectedProcedure
    .input(createCheckoutOrUpdateInput)
    .mutation(async ({ ctx, input }) => {
      configureLemonSqueezy();

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

      if (mode === "update" && userSubscription?.subscriptionId) {
        const subscriptionId = userSubscription.subscriptionId;

        if (userSubscription.variantId === variantId) {
          return { status: "updated" as const, message: "You are already on this plan." };
        }

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

      const promoCode = checkoutDiscountCode();
      const attribution = { source: input.source, ...input.utm };
      const { result: checkout, discountCode: sentPromoCode } =
        await createCheckoutWithPromoFallback(
          (discountCode) =>
            createCheckout(env.LEMONSQUEEZY_STORE_ID!, variantId, {
              checkoutOptions: {
                // The app opens the URL as a full page; an embed checkout's close button only works
                // inside the Lemon.js overlay.
                embed: false,
                media: false,
              },
              checkoutData: {
                email: user?.email ?? undefined,
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

      void runBackgroundTask(
        recordCheckoutStart({
          userId,
          plan: input.plan,
          interval: input.interval,
          source: input.source ?? null,
          promoCode: sentPromoCode ?? null,
        }),
      );

      captureServerEvent(
        { id: userId, email: user?.email },
        "checkout_started",
        checkoutEventProperties({
          plan: input.plan,
          interval: input.interval,
          discount_code: sentPromoCode,
          ...attribution,
        }),
      );

      return { status: "redirect" as const, url };
    }),

  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    configureLemonSqueezy();

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
    if (mode !== "update" || !userSubscription?.subscriptionId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No active subscription found" });
    }

    const subscriptionId = userSubscription.subscriptionId;
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
    configureLemonSqueezy();

    const userId = ctx.auth.userId;
    const userSubscription = await getUserSubscription(ctx);

    if (getSubscriptionMode(userSubscription) !== "resume" || !userSubscription?.subscriptionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "There is no cancelled or paused subscription to resume.",
      });
    }

    const subscriptionId = userSubscription.subscriptionId;
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
    configureLemonSqueezy();

    const userSubscription = await getUserSubscription(ctx);

    if (!userSubscription) {
      throw new Error("No active subscription found");
    }

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

    throw new Error("Unable to retrieve subscription management URL");
  }),

  // The subscription's update-payment-method page. Lemon Squeezy signs this URL
  // and it expires, so it is fetched fresh on every visit instead of stored.
  // Falls back to the customer portal like subscriptionDetails (Settings →
  // Billing); null when neither is available.
  updatePaymentMethodUrl: protectedProcedure.query(async ({ ctx }) => {
    const userSubscription = await getUserSubscription(ctx);
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
      configureLemonSqueezy();

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
      if (mode !== "update" || !userSubscription?.subscriptionId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No active subscription found" });
      }

      const subscriptionId = userSubscription.subscriptionId;
      const currentPlan = resolvePlan(userSubscription);

      // Validate this is actually a downgrade
      const planOrder = { free: 0, pro: 1, ultra: 2 };
      if (planOrder[targetPlan] >= planOrder[currentPlan]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid downgrade request - target plan is not lower than current plan",
        });
      }

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
        const cancelledSub = await cancelSubscription(subscriptionId);

        if (cancelledSub.error) {
          throw providerError("cancel", cancelledSub, { userId, subscriptionId });
        }

        const attributes = cancelledSub.data.data.attributes;
        // Keep plan/variant: access is retained until endsAt, and
        // resolvePlan() drops the user to free once that date passes.
        await applyProviderState(ctx, subscriptionId, attributes);
        await recordCancellation(ctx, userSubscription, currentPlan, {
          ...cancellation,
          outcome: "cancelled",
        });

        return {
          status: "cancelled" as const,
          message: attributes.ends_at
            ? `Your subscription has been cancelled. You'll keep access until ${formatDate(new Date(attributes.ends_at))}.`
            : "Your subscription has been cancelled. You'll keep access until the end of your billing period.",
        };
      }

      // Downgrade to Pro (from Ultra), keeping the current interval. Lemon
      // Squeezy switches the variant now and credits the unused time on the
      // next invoice (invoiceImmediately: false), so the plan changes now.
      const interval = subscriptionInterval(userSubscription);
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
      configureLemonSqueezy();

      const userId = ctx.auth.userId;
      const [userRecord, userSubscription] = await Promise.all([
        ctx.db.query.user.findFirst({ where: (table, { eq }) => eq(table.id, userId) }),
        getUserSubscription(ctx),
      ]);

      if (!userSubscription?.subscriptionId || !canOfferPause(userSubscription)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only an active monthly subscription can be paused.",
        });
      }

      const subscriptionId = userSubscription.subscriptionId;
      const currentPlan = resolvePlan(userSubscription);
      const resumesAt = pauseResumesAt(input.months);

      const pausedSub = await updateSubscription(subscriptionId, pauseUpdate(resumesAt));
      if (pausedSub.error) {
        throw providerError("pause", pausedSub, { userId, subscriptionId });
      }

      const attributes = pausedSub.data.data.attributes;
      await applyProviderState(ctx, subscriptionId, attributes);
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

      const restartsAt = attributes.pause?.resumes_at
        ? new Date(attributes.pause.resumes_at)
        : resumesAt;
      return {
        message: `Billing is paused. It restarts on ${formatDate(restartsAt)}.`,
      };
    }),
});

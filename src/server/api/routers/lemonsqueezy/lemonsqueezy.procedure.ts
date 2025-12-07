import {
  cancelSubscription,
  createCheckout,
  getCustomer,
  getSubscription,
  updateSubscription,
} from "@lemonsqueezy/lemonsqueezy.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { PLAN_VARIANT_IDS, resolvePlan } from "@/lib/billing/plans";
import { configureLemonSqueezy } from "@/lib/config/lemonsqueezy";
import { sendDowngradeFeedbackNotification } from "@/server/lib/notifications/discord";
import { subscription } from "@/server/db/schema";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import {
  downgradeWithFeedbackInput,
  downgradeReasonLabels,
} from "./lemonsqueezy.input";

export const lemonsqueezyRouter = createTRPCRouter({
  createCheckoutOrUpdate: protectedProcedure
    .input(
      z.object({
        plan: z.enum(["pro", "ultra"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      configureLemonSqueezy();

      const userId = ctx.auth.userId;
      const variantId = PLAN_VARIANT_IDS[input.plan];

      const user = await ctx.db.query.user.findFirst({
        where: (table, { eq }) => eq(table.id, userId),
      });

      const userSubscription = await ctx.db.query.subscription.findFirst({
        where: (table, { eq }) => eq(table.userId, userId),
      });

      // Check if user has an active subscription
      if (
        userSubscription &&
        userSubscription.status === "active" &&
        userSubscription.subscriptionId
      ) {
        // If the user is already on the requested plan, do nothing
        if (userSubscription.variantId === variantId) {
          return {
            status: "updated",
            message: "You are already on this plan.",
          };
        }

        // Update existing subscription
        const updatedSub = await updateSubscription(
          userSubscription.subscriptionId,
          {
            variantId: variantId,
            invoiceImmediately: true,
          }
        );

        if (updatedSub.error) {
          throw new Error(updatedSub.error.message);
        }

        // Update local DB to reflect the change immediately (optional but good for UI)
        try {
          await ctx.db
            .update(subscription)
            .set({
              plan: input.plan,
              variantId: variantId,
              status: updatedSub.data.data.attributes.status,
              endsAt: updatedSub.data.data.attributes.ends_at
                ? new Date(updatedSub.data.data.attributes.ends_at)
                : null,
              renewsAt: updatedSub.data.data.attributes.renews_at
                ? new Date(updatedSub.data.data.attributes.renews_at)
                : null,
            })
            .where(eq(subscription.userId, userId));
        } catch (e) {
          console.error("Failed to update local subscription state", e);
        }

        return { status: "updated", message: "Plan updated successfully!" };
      }

      // No active subscription, create a new checkout
      const checkout = await createCheckout(
        process.env.LEMONSQUEEZY_STORE_ID!,
        variantId,
        {
          checkoutOptions: {
            embed: true,
            media: false,
          },
          checkoutData: {
            email: user!.email ?? undefined,
            custom: {
              user_id: userId,
            },
          },
          productOptions: {
            enabledVariants: [variantId],
            redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings#billing`,
            receiptButtonText: "Go to Dashboard",
            receiptThankYouNote: `Thank you for signing up to iShortn ${
              input.plan.charAt(0).toUpperCase() + input.plan.slice(1)
            }!`,
          },
        }
      );

      return { status: "redirect", url: checkout.data?.data.attributes.url };
    }),

  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    configureLemonSqueezy();

    const userId = ctx.auth.userId;

    const userSubscription = await ctx.db.query.subscription.findFirst({
      where: (table, { eq }) => eq(table.userId, userId),
    });

    if (!userSubscription) {
      throw new Error("No active subscription found");
    }

    const cancelledSub = await cancelSubscription(
      userSubscription.subscriptionId!
    );

    if (cancelledSub.error) {
      throw new Error(cancelledSub.error.message);
    }

    try {
      await ctx.db
        .update(subscription)
        .set({
          status: cancelledSub.data?.data.attributes.status,
          plan: "free",
          variantId: 0,
          productId: 0,
          endsAt: cancelledSub.data?.data.attributes.ends_at
            ? new Date(cancelledSub.data?.data.attributes.ends_at)
            : null,
        })
        .where(eq(subscription.userId, userId));
    } catch (_e) {
      throw new Error("Failed to update subscription status");
    }

    return cancelledSub;
  }),

  subscriptionDetails: protectedProcedure.mutation(async ({ ctx }) => {
    configureLemonSqueezy();

    const userId = ctx.auth.userId;

    const userSubscription = await ctx.db.query.subscription.findFirst({
      where: (table, { eq }) => eq(table.userId, userId),
    });

    console.log("User Subscription", userSubscription);

    if (!userSubscription) {
      throw new Error("No active subscription found");
    }

    // Try to get subscription details if we have a valid subscriptionId
    if (
      userSubscription.subscriptionId &&
      userSubscription.subscriptionId > 0
    ) {
      const userSub = await getSubscription(userSubscription.subscriptionId);

      if (!userSub.error) {
        return userSub.data.data.attributes.urls;
      }
    }

    // Fall back to customer portal if we have a valid customerId
    if (userSubscription.customerId && userSubscription.customerId > 0) {
      const customer = await getCustomer(userSubscription.customerId);

      if (
        !customer.error &&
        customer.data.data.attributes.urls.customer_portal
      ) {
        return {
          customer_portal: customer.data.data.attributes.urls.customer_portal,
          update_payment_method: null as string | null,
        };
      }
    }

    throw new Error("Unable to retrieve subscription management URL");
  }),

  downgradeWithFeedback: protectedProcedure
    .input(downgradeWithFeedbackInput)
    .mutation(async ({ ctx, input }) => {
      configureLemonSqueezy();

      const userId = ctx.auth.userId;
      const { targetPlan, reason, additionalFeedback } = input;

      // Get user info for notification
      const userRecord = await ctx.db.query.user.findFirst({
        where: (table, { eq }) => eq(table.id, userId),
      });

      // Get current subscription
      const userSubscription = await ctx.db.query.subscription.findFirst({
        where: (table, { eq }) => eq(table.userId, userId),
      });

      if (!userSubscription || userSubscription.status !== "active") {
        throw new Error("No active subscription found");
      }

      const currentPlan = resolvePlan(userSubscription);

      // Validate this is actually a downgrade
      const planOrder = { free: 0, pro: 1, ultra: 2 };
      if (planOrder[targetPlan] >= planOrder[currentPlan]) {
        throw new Error(
          "Invalid downgrade request - target plan is not lower than current plan"
        );
      }

      // Send feedback notification (fire and forget)
      void sendDowngradeFeedbackNotification({
        userEmail: userRecord?.email ?? "unknown",
        userName: userRecord?.name,
        fromPlan: currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1),
        toPlan: targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1),
        reason: downgradeReasonLabels[reason],
        additionalFeedback,
      });

      // Handle downgrade to free (cancellation)
      if (targetPlan === "free") {
        const cancelledSub = await cancelSubscription(
          userSubscription.subscriptionId!
        );

        if (cancelledSub.error) {
          throw new Error(cancelledSub.error.message);
        }

        await ctx.db
          .update(subscription)
          .set({
            status: cancelledSub.data?.data.attributes.status,
            plan: "free",
            variantId: 0,
            productId: 0,
            endsAt: cancelledSub.data?.data.attributes.ends_at
              ? new Date(cancelledSub.data?.data.attributes.ends_at)
              : null,
          })
          .where(eq(subscription.userId, userId));

        return {
          status: "cancelled" as const,
          message:
            "Your subscription has been cancelled. You'll retain access until the end of your billing period.",
        };
      }

      // Handle downgrade to pro (from ultra)
      const variantId = PLAN_VARIANT_IDS[targetPlan];

      const updatedSub = await updateSubscription(
        userSubscription.subscriptionId!,
        {
          variantId: variantId,
          invoiceImmediately: false,
        }
      );

      if (updatedSub.error) {
        throw new Error(updatedSub.error.message);
      }

      await ctx.db
        .update(subscription)
        .set({
          plan: targetPlan,
          variantId: variantId,
          status: updatedSub.data.data.attributes.status,
          endsAt: updatedSub.data.data.attributes.ends_at
            ? new Date(updatedSub.data.data.attributes.ends_at)
            : null,
          renewsAt: updatedSub.data.data.attributes.renews_at
            ? new Date(updatedSub.data.data.attributes.renews_at)
            : null,
        })
        .where(eq(subscription.userId, userId));

      return {
        status: "downgraded" as const,
        message: "Your plan has been downgraded successfully!",
      };
    }),
});

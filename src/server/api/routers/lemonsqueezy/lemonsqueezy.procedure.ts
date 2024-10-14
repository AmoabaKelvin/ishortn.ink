import { cancelSubscription, createCheckout, getSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import { eq } from "drizzle-orm";

import { configureLemonSqueezy } from "@/config/lemonsqueezy";
import { subscription } from "@/server/db/schema";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

export const lemonsqueezyRouter = createTRPCRouter({
  createCheckoutUrl: protectedProcedure.mutation(async ({ ctx }) => {
    configureLemonSqueezy();

    const userId = ctx.auth.userId;
    const variantId = Number(process.env.LEMONSQUEEZY_VARIANT_ID!);

    const user = await ctx.db.query.user.findFirst({
      where: (table, { eq }) => eq(table.id, userId),
    });

    const checkout = await createCheckout(process.env.LEMONSQUEEZY_STORE_ID!, variantId, {
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
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/billing/`,
        receiptButtonText: "Go to Dashboard",
        receiptThankYouNote: "Thank you for signing up to iShortn Pro!",
      },
    });

    return checkout.data?.data.attributes.url;
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

    const cancelledSub = await cancelSubscription(userSubscription.subscriptionId!);

    if (cancelledSub.error) {
      throw new Error(cancelledSub.error.message);
    }

    try {
      await ctx.db
        .update(subscription)
        .set({
          status: cancelledSub.data?.data.attributes.status,
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

    if (!userSubscription) {
      throw new Error("No active subscription found");
    }

    const userSub = await getSubscription(userSubscription.subscriptionId!);

    if (userSub.error) {
      throw new Error(userSub.error.message);
    }

    return userSub.data.data.attributes.urls;
  }),
});

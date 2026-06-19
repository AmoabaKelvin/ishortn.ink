import { z } from "zod";

import { isSubscriptionEntitled } from "@/lib/billing/plans";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { generateAliasFromMetadata } from "./ai.service";

const metadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  url: z.string().url(),
});

export const aiRouter = createTRPCRouter({
  generateAlias: protectedProcedure.input(metadataSchema).mutation(async ({ ctx, input }) => {
    const userSubscription = await ctx.db.query.subscription.findFirst({
      where: (table, { eq }) => eq(table.userId, ctx.auth.userId),
    });

    if (!isSubscriptionEntitled(userSubscription)) {
      throw new Error("You need an active subscription to use AI features");
    }
    const alias = await generateAliasFromMetadata(input);

    return { alias };
  }),
});

export type AIRouter = typeof aiRouter;

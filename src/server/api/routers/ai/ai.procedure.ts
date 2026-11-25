import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getUserPlanContext } from "@/server/lib/user-plan";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { generateAliasFromMetadata } from "./ai.service";

const metadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  url: z.string().url(),
});

export const aiRouter = createTRPCRouter({
  generateAlias: protectedProcedure.input(metadataSchema).mutation(async ({ ctx, input }) => {
    const planCtx = await getUserPlanContext(ctx.auth.userId, ctx.db);

    if (!planCtx || planCtx.plan === "free") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You need an active subscription to use AI features",
      });
    }
    const alias = await generateAliasFromMetadata(input);

    return { alias };
  }),
});

export type AIRouter = typeof aiRouter;

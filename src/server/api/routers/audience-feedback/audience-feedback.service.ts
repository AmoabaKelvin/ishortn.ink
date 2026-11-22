import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";

import { resolvePlan } from "@/lib/billing/plans";
import { audienceFeedback } from "@/server/db/schema";

import { acquisitionAnswerValues, acquisitionPromptState } from "./utils";

import type { ProtectedTRPCContext } from "../../trpc";
import type { SubmitAcquisitionInput } from "./audience-feedback.input";

// The account's own plan: acquisition is asked per person, whichever workspace is open.
const getUserPlan = async (ctx: ProtectedTRPCContext) => {
  const userRecord = await ctx.db.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, ctx.auth.userId),
    columns: { id: true },
    with: { subscriptions: true },
  });
  return resolvePlan(userRecord?.subscriptions ?? null);
};

export const getAcquisitionPrompt = async (ctx: ProtectedTRPCContext) => {
  const [plan, row] = await Promise.all([
    getUserPlan(ctx),
    ctx.db.query.audienceFeedback.findFirst({
      where: eq(audienceFeedback.userId, ctx.auth.userId),
      columns: {
        submittedAt: true,
        acquisitionAnsweredAt: true,
        acquisitionDismissedAt: true,
        acquisitionDismissCount: true,
      },
    }),
  ]);
  return acquisitionPromptState(plan, row);
};

export const submitAcquisition = async (
  ctx: ProtectedTRPCContext,
  input: SubmitAcquisitionInput,
  now = new Date(),
) => {
  const plan = await getUserPlan(ctx);
  if (plan === "free") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This question is only asked on paid plans.",
    });
  }

  const values = acquisitionAnswerValues(input, plan, now);
  await ctx.db
    .insert(audienceFeedback)
    .values({ userId: ctx.auth.userId, ...values })
    .onDuplicateKeyUpdate({ set: values });

  return { success: true, plan };
};

export const dismissAcquisition = async (ctx: ProtectedTRPCContext, now = new Date()) => {
  await ctx.db
    .insert(audienceFeedback)
    .values({
      userId: ctx.auth.userId,
      acquisitionDismissedAt: now,
      acquisitionDismissCount: 1,
    })
    .onDuplicateKeyUpdate({
      set: {
        acquisitionDismissedAt: now,
        acquisitionDismissCount: sql`${audienceFeedback.acquisitionDismissCount} + 1`,
      },
    });

  return { success: true };
};

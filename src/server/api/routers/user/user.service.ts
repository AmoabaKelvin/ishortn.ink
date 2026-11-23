import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { displayName } from "@/lib/utils/user-name";
import { user } from "@/server/db/schema";

import type { ProtectedTRPCContext } from "../../trpc";
import type { UpdateNotificationPreferencesInput, UpdateUserProfileInput } from "./user.input";

export async function getUserProfile(ctx: ProtectedTRPCContext) {
  const userProfile = await ctx.db.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, ctx.auth.userId),
    columns: {
      id: true,
      name: true,
      email: true,
      imageUrl: true,
      isAdmin: true,
      productEmailsEnabled: true,
      weeklySummaryEnabled: true,
    },
  });

  if (!userProfile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User profile not found",
    });
  }

  return { ...userProfile, name: displayName(userProfile.name) };
}

export async function updateUserProfile(ctx: ProtectedTRPCContext, input: UpdateUserProfileInput) {
  await ctx.db.update(user).set({ name: input.name }).where(eq(user.id, ctx.auth.userId));

  return getUserProfile(ctx);
}

export async function updateNotificationPreferences(
  ctx: ProtectedTRPCContext,
  input: UpdateNotificationPreferencesInput,
) {
  await ctx.db
    .update(user)
    .set({
      productEmailsEnabled: input.productEmailsEnabled,
      weeklySummaryEnabled: input.weeklySummaryEnabled,
    })
    .where(eq(user.id, ctx.auth.userId));

  return input;
}

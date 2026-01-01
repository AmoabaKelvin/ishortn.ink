import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import { user } from "@/server/db/schema";

import type { ProtectedTRPCContext } from "../../trpc";
import type { UpdateUserProfileInput } from "./user.input";

export async function getUserProfile(ctx: ProtectedTRPCContext) {
  const userProfile = await ctx.db.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, ctx.auth.userId),
    columns: {
      id: true,
      name: true,
      email: true,
      imageUrl: true,
    },
  });

  if (!userProfile) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User profile not found",
    });
  }

  return userProfile;
}

export async function updateUserProfile(
  ctx: ProtectedTRPCContext,
  input: UpdateUserProfileInput,
) {
  await ctx.db
    .update(user)
    .set({ name: input.name })
    .where(eq(user.id, ctx.auth.userId));

  return getUserProfile(ctx);
}

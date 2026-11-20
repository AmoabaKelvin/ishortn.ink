import crypto from "node:crypto";

import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import { canUseApi, getApiAccess } from "@/lib/billing/api-access";
import { resolvePlan } from "@/lib/billing/plans";
import { subscription, token } from "@/server/db/schema";
import { getApiSunset } from "@/server/lib/api-access";

import type { ProtectedTRPCContext } from "../../trpc";
import type { CreateTokenInput, DeleteTokenInput } from "./token.input";

function generateToken() {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const nanoid = customAlphabet(alphabet, 29);

  return nanoid();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const getTokens = async (ctx: ProtectedTRPCContext) => {
  return await ctx.db.select().from(token).where(eq(token.userId, ctx.auth.userId));
};

const getSubscription = async (ctx: ProtectedTRPCContext) => {
  const sub = await ctx.db.query.subscription.findFirst({
    where: eq(subscription.userId, ctx.auth.userId),
  });
  return sub ?? null;
};

/** The account's API plan state for the settings page. */
export const getApiAccessStatus = async (ctx: ProtectedTRPCContext) => {
  const sub = await getSubscription(ctx);
  const canCreateKeys = canUseApi(resolvePlan(sub));
  return {
    canCreateKeys,
    access: getApiAccess(sub, canCreateKeys ? null : await getApiSunset(), new Date()),
  };
};

export const createToken = async (ctx: ProtectedTRPCContext, input: CreateTokenInput) => {
  if (!canUseApi(resolvePlan(await getSubscription(ctx)))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "API access is a Pro feature. Upgrade to Pro to create API keys.",
    });
  }

  const generatedToken = generateToken();

  const newToken = await ctx.db.insert(token).values({
    ...input,
    token: hashToken(generatedToken),
    userId: ctx.auth.userId,
  });

  const newTokenId = newToken[0].insertId;

  const retrievedToken = await ctx.db.select().from(token).where(eq(token.id, newTokenId));

  retrievedToken[0]!.token = generatedToken;

  return retrievedToken;
};

export const deleteToken = async (ctx: ProtectedTRPCContext, input: DeleteTokenInput) => {
  return await ctx.db
    .delete(token)
    .where(and(eq(token.id, input.id), eq(token.userId, ctx.auth.userId)));
};

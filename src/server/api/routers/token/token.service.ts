import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import { token } from "@/server/db/schema";

import type { ProtectedTRPCContext } from "../../trpc";

import type { CreateTokenInput, DeleteTokenInput } from "./token.input";

function generateToken() {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const nanoid = customAlphabet(alphabet, 29);

  return nanoid();
}

function hashToken(token: string) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");

  return token.slice(0, 7) + hash;
}

export const getTokens = async (ctx: ProtectedTRPCContext) => {
  return await ctx.db.select().from(token).where(eq(token.userId, ctx.auth.userId));
};

export const createToken = async (ctx: ProtectedTRPCContext, input: CreateTokenInput) => {
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

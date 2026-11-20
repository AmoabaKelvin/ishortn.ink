import crypto from "node:crypto";

import { TRPCError } from "@trpc/server";
import { and, count, desc, eq } from "drizzle-orm";
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
  return crypto.createHash("sha256").update(token).digest("hex");
}

const TOKEN_PREFIX_LENGTH = 6;
// Keeps the settings list (which shows every key) bounded.
const MAX_TOKENS_PER_USER = 25;

export const getTokens = async (ctx: ProtectedTRPCContext) => {
  // Never select the hash: the list is sent to the browser.
  return await ctx.db
    .select({
      id: token.id,
      name: token.name,
      prefix: token.prefix,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt,
    })
    .from(token)
    .where(eq(token.userId, ctx.auth.userId))
    .orderBy(desc(token.createdAt), desc(token.id));
};

export const createToken = async (ctx: ProtectedTRPCContext, input: CreateTokenInput) => {
  const [existing] = await ctx.db
    .select({ count: count() })
    .from(token)
    .where(eq(token.userId, ctx.auth.userId));
  if ((existing?.count ?? 0) >= MAX_TOKENS_PER_USER) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You can have up to ${MAX_TOKENS_PER_USER} API keys. Revoke one to create another.`,
    });
  }

  const generatedToken = generateToken();

  const newToken = await ctx.db.insert(token).values({
    name: input.name,
    prefix: generatedToken.slice(0, TOKEN_PREFIX_LENGTH),
    token: hashToken(generatedToken),
    userId: ctx.auth.userId,
  });

  return { id: newToken[0].insertId, name: input.name, token: generatedToken };
};

export const deleteToken = async (ctx: ProtectedTRPCContext, input: DeleteTokenInput) => {
  const [result] = await ctx.db
    .delete(token)
    .where(and(eq(token.id, input.id), eq(token.userId, ctx.auth.userId)));

  if (result.affectedRows === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
  }
};

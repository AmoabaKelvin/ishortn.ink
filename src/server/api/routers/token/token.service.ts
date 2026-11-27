import crypto from "node:crypto";

import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import { canUseApi, getApiAccess } from "@/lib/billing/api-access";
import { NO_GRACE } from "@/lib/billing/entitlements";
import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/constants/moderation";
import { browserFromLabel } from "@/lib/extension/connect";
import { token, user } from "@/server/db/schema";
import { captureServerEvent } from "@/server/lib/analytics/posthog-server";
import { getApiSunset } from "@/server/lib/api-access";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";
import { getUserPlanContext } from "@/server/lib/user-plan";
import { hasMinimumRole, requireMinimumRole } from "@/server/lib/workspace";

import type { ProtectedTRPCContext, TeamTRPCContext } from "../../trpc";
import type { CreateExtensionTokenInput, CreateTokenInput, DeleteTokenInput } from "./token.input";

function generateToken() {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const nanoid = customAlphabet(alphabet, 29);

  return nanoid();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const TOKEN_PREFIX_LENGTH = 6;
// Keeps the settings lists (which show every key) bounded.
const MAX_TOKENS_PER_USER = 25;
const MAX_TOKENS_PER_TEAM = 25;
export const MAX_EXTENSION_TOKENS_PER_USER = 10;
// extension_connected's `newAccount`: connected within an hour of signing up.
const NEW_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

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
    .where(and(eq(token.userId, ctx.auth.userId), eq(token.kind, "api"), isNull(token.teamId)))
    .orderBy(desc(token.createdAt), desc(token.id));
};

/** The account's API plan state for the settings page. */
export const getApiAccessStatus = async (ctx: ProtectedTRPCContext) => {
  const planContext = await getUserPlanContext(ctx.auth.userId, ctx.db);
  const canCreateKeys = canUseApi(planContext?.plan ?? "free");
  return {
    canCreateKeys,
    access: getApiAccess(
      planContext?.subscription ?? null,
      planContext?.userRecord ?? NO_GRACE,
      canCreateKeys ? null : await getApiSunset(),
      new Date(),
    ),
  };
};

export const createToken = async (ctx: ProtectedTRPCContext, input: CreateTokenInput) => {
  const planContext = await getUserPlanContext(ctx.auth.userId, ctx.db);
  const plan = planContext?.plan ?? "free";
  if (!canUseApi(plan)) {
    await recordPlanLimitHit({ userId: ctx.auth.userId, limitKey: "api_keys", plan });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "API access is a Pro feature. Upgrade to Pro to create API keys.",
    });
  }

  const [existing] = await ctx.db
    .select({ count: count() })
    .from(token)
    .where(and(eq(token.userId, ctx.auth.userId), eq(token.kind, "api"), isNull(token.teamId)));
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
    .where(
      and(
        eq(token.id, input.id),
        eq(token.userId, ctx.auth.userId),
        eq(token.kind, "api"),
        isNull(token.teamId),
      ),
    );

  if (result.affectedRows === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
  }
};

const MANAGE_TEAM_KEYS = "Managing team API keys";

/**
 * The team's API keys for the settings page: every member sees them, owners and admins
 * manage them. Keys belong to the team, so a removed member's keys stay listed.
 */
export const getTeamTokens = async (ctx: TeamTRPCContext) => {
  const keys = await ctx.db
    .select({
      id: token.id,
      name: token.name,
      prefix: token.prefix,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt,
      createdBy: { name: user.name, email: user.email },
    })
    .from(token)
    .leftJoin(user, eq(user.id, token.userId))
    .where(and(eq(token.teamId, ctx.workspace.teamId), eq(token.kind, "api")))
    .orderBy(desc(token.createdAt), desc(token.id))
    .limit(MAX_TOKENS_PER_TEAM);
  return {
    keys,
    canManage: hasMinimumRole(ctx.workspace, "admin"),
    active: !ctx.workspace.readOnly,
  };
};

export const createTeamToken = async (ctx: TeamTRPCContext, input: CreateTokenInput) => {
  requireMinimumRole(ctx.workspace, "admin", MANAGE_TEAM_KEYS);
  if (ctx.restrictedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: ACCOUNT_RESTRICTED_MESSAGE });
  }
  const teamId = ctx.workspace.teamId;
  const generatedToken = generateToken();

  // Locking the team's keys keeps two parallel creates from both passing the limit.
  const id = await ctx.db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: token.id })
      .from(token)
      .where(and(eq(token.teamId, teamId), eq(token.kind, "api")))
      .for("update");
    if (existing.length >= MAX_TOKENS_PER_TEAM) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `A team can have up to ${MAX_TOKENS_PER_TEAM} API keys. Revoke one to create another.`,
      });
    }
    const [inserted] = await tx.insert(token).values({
      name: input.name,
      prefix: generatedToken.slice(0, TOKEN_PREFIX_LENGTH),
      token: hashToken(generatedToken),
      userId: ctx.auth.userId,
      teamId,
      createdByUserId: ctx.auth.userId,
    });
    return inserted.insertId;
  });

  return { id, name: input.name, token: generatedToken };
};

export const deleteTeamToken = async (ctx: TeamTRPCContext, input: DeleteTokenInput) => {
  requireMinimumRole(ctx.workspace, "admin", MANAGE_TEAM_KEYS);
  const [result] = await ctx.db
    .delete(token)
    .where(
      and(eq(token.id, input.id), eq(token.teamId, ctx.workspace.teamId), eq(token.kind, "api")),
    );

  if (result.affectedRows === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
  }
};

export const getExtensionTokens = async (ctx: ProtectedTRPCContext) => {
  return await ctx.db
    .select({
      id: token.id,
      label: token.label,
      prefix: token.prefix,
      createdAt: token.createdAt,
      lastUsedAt: token.lastUsedAt,
    })
    .from(token)
    .where(and(eq(token.userId, ctx.auth.userId), eq(token.kind, "extension")))
    .orderBy(desc(token.createdAt), desc(token.id));
};

/**
 * Issues a browser extension token on any plan (it only works on /api/extension). Keeps the
 * newest MAX_EXTENSION_TOKENS_PER_USER: connecting one more browser revokes the oldest.
 */
export const createExtensionToken = async (
  ctx: ProtectedTRPCContext,
  input: CreateExtensionTokenInput,
) => {
  const userId = ctx.auth.userId;
  const generatedToken = generateToken();

  await ctx.db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: token.id })
      .from(token)
      .where(and(eq(token.userId, userId), eq(token.kind, "extension")))
      .orderBy(asc(token.createdAt), asc(token.id))
      .for("update");
    const excess = existing.length - (MAX_EXTENSION_TOKENS_PER_USER - 1);
    if (excess > 0) {
      const oldest = existing.slice(0, excess).map((row) => row.id);
      await tx.delete(token).where(and(eq(token.userId, userId), inArray(token.id, oldest)));
    }
    await tx.insert(token).values({
      kind: "extension",
      label: input.label,
      prefix: generatedToken.slice(0, TOKEN_PREFIX_LENGTH),
      token: hashToken(generatedToken),
      userId,
    });
  });

  const planContext = await getUserPlanContext(userId, ctx.db);
  const createdAt = planContext?.userRecord.createdAt;
  captureServerEvent({ id: userId, email: planContext?.userRecord.email }, "extension_connected", {
    plan: planContext?.plan ?? "free",
    newAccount: !!createdAt && Date.now() - createdAt.getTime() <= NEW_ACCOUNT_WINDOW_MS,
    browser: browserFromLabel(input.label),
  });

  return { token: generatedToken };
};

export const deleteExtensionToken = async (ctx: ProtectedTRPCContext, input: DeleteTokenInput) => {
  const [result] = await ctx.db
    .delete(token)
    .where(
      and(eq(token.id, input.id), eq(token.userId, ctx.auth.userId), eq(token.kind, "extension")),
    );

  if (result.affectedRows === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Browser not found" });
  }
};

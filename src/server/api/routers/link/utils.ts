import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";

import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { redis } from "@/lib/core/cache";
import { normalizeAlias, parseReferrer } from "@/lib/utils";
import { isBot } from "@/lib/utils/is-bot";
import { link, linkVisit, siteSettings, team, uniqueLinkVisit, user } from "@/server/db/schema";
import { getUserPlanContext, normalizeMonthlyLinkCount } from "@/server/lib/user-plan";
import { registerEventUsage } from "@/server/lib/event-usage";
import { sendEventUsageEmail } from "@/server/lib/notifications/event-usage";

import type { Link } from "@/server/db/schema";
import type { ProtectedTRPCContext, PublicTRPCContext, WorkspaceTRPCContext } from "../../trpc";
export async function logAnalytics(ctx: PublicTRPCContext, link: Link, from: string) {
  if (link.passwordHash) {
    return;
  }

  if (from === "metadata") {
    return;
  }

  const userAgent = ctx.headers.get("user-agent");

  if (userAgent && isBot(userAgent)) {
    return;
  }

  const deviceDetails = await retrieveDeviceAndGeolocationData(ctx.headers);

  const usage = await registerEventUsage(link.userId, ctx.db);

  if (usage.alertLevelTriggered && usage.limit && usage.userEmail && usage.plan) {
    await sendEventUsageEmail({
      email: usage.userEmail,
      name: usage.userName,
      threshold: usage.alertLevelTriggered,
      limit: usage.limit,
      currentCount: usage.currentCount,
      plan: usage.plan,
    });
  }

  if (!usage.allowed) {
    return;
  }

  await ctx.db.insert(linkVisit).values({
    linkId: link.id,
    ...deviceDetails,
    referer: parseReferrer(ctx.headers.get("referer")),
  });

  const ipHash = crypto
    .createHash("sha256")
    .update(ctx.headers.get("x-forwarded-for") ?? "")
    .digest("hex");

  const existingLinkVisit = await ctx.db.query.uniqueLinkVisit.findFirst({
    where: (table, { eq, and }) => and(eq(table.linkId, link.id), eq(table.ipHash, ipHash)),
  });

  if (!existingLinkVisit) {
    await ctx.db.insert(uniqueLinkVisit).values({
      linkId: link.id,
      ipHash,
    });
  }
}

export async function checkAndUpdateLinkLimit(ctx: ProtectedTRPCContext) {
  const planCtx = await getUserPlanContext(ctx.auth.userId, ctx.db);

  if (!planCtx) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  const { plan, caps } = planCtx;
  const currentCount = await normalizeMonthlyLinkCount(planCtx, ctx.db);
  const limit = caps.linksLimit;

  if (limit !== undefined && currentCount >= limit) {
    const limitText = limit.toLocaleString();
    const linkLimitMessage =
      plan === "free"
        ? `You've reached your monthly limit of ${limitText} links. Upgrade to Pro for more.`
        : `You've reached your monthly limit of ${limitText} links. Upgrade to Ultra for unlimited links.`;

    throw new TRPCError({
      code: "FORBIDDEN",
      message: linkLimitMessage,
    });
  }

  return {
    plan,
    currentCount,
    limit,
    isProUser: plan !== "free",
  };
}

/**
 * Workspace-aware link limit check.
 * Team workspaces bypass limits (they're Ultra with unlimited links).
 * Personal workspaces check against the user's plan limits.
 */
export async function checkWorkspaceLinkLimit(ctx: WorkspaceTRPCContext) {
  // Team workspaces have unlimited links (Ultra plan)
  if (ctx.workspace.type === "team") {
    return {
      plan: "ultra" as const,
      currentCount: 0,
      limit: undefined,
      isProUser: true,
    };
  }

  // Personal workspace: check user's plan limits
  return checkAndUpdateLinkLimit(ctx);
}

export async function incrementLinkCount(
  ctx: ProtectedTRPCContext,
  currentCount: number,
  limit?: number
) {
  if (limit === undefined) {
    return;
  }

  await ctx.db
    .update(user)
    .set({
      monthlyLinkCount: currentCount + 1,
    })
    .where(eq(user.id, ctx.auth.userId));
}

/**
 * Workspace-aware link count increment.
 * Only increments for personal workspaces since team workspaces have no limits.
 */
export async function incrementWorkspaceLinkCount(
  ctx: WorkspaceTRPCContext,
  currentCount: number,
  limit?: number
) {
  // Don't track usage for team workspaces
  if (ctx.workspace.type === "team") {
    return;
  }

  return incrementLinkCount(ctx, currentCount, limit);
}

export async function getUserDefaultDomain(ctx: ProtectedTRPCContext): Promise<string> {
  const cacheKey = `user_settings_domain:${ctx.auth.userId}`;
  const cachedDomain = await redis.get(cacheKey);

  if (cachedDomain) {
    return cachedDomain ?? "ishortn.ink";
  }

  const userInfo = await ctx.db.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, ctx.auth.userId),
    with: {
      siteSettings: true,
    },
  });

  const defaultDomain = userInfo?.siteSettings?.defaultDomain ?? "ishortn.ink";
  await redis.set(cacheKey, defaultDomain, "EX", 300); // 5 minutes

  return defaultDomain;
}

/**
 * Workspace-aware default domain lookup.
 * For team workspaces: uses team's default domain
 * For personal workspaces: uses user's site settings
 */
export async function getWorkspaceDefaultDomain(ctx: WorkspaceTRPCContext): Promise<string> {
  if (ctx.workspace.type === "team") {
    const cacheKey = `team_default_domain:${ctx.workspace.teamId}`;
    const cachedDomain = await redis.get(cacheKey);

    if (cachedDomain) {
      return cachedDomain;
    }

    // Get team's default domain from the team record
    const teamRecord = await ctx.db.query.team.findFirst({
      where: eq(team.id, ctx.workspace.teamId),
    });

    const defaultDomain = teamRecord?.defaultDomain ?? "ishortn.ink";
    await redis.set(cacheKey, defaultDomain, "EX", 300); // 5 minutes

    return defaultDomain;
  }

  // Personal workspace: use user's default domain
  return getUserDefaultDomain(ctx);
}

const MINIMUM_ALIAS_LENGTH_FREE = 6;

export const validateAlias = (
  ctx: ProtectedTRPCContext,
  alias: string,
  domain: string,
  isPaidUser: boolean = false,
): Promise<void> => {
  const aliasRegex = /^[a-zA-Z0-9-_]+$/;

  if (!aliasRegex.test(alias)) {
    throw new Error("Alias can only contain alphanumeric characters, dashes, and underscores");
  }

  if (alias.includes(".")) {
    throw new Error("Cannot include periods in alias");
  }

  // Free users must have aliases with at least 6 characters
  if (!isPaidUser && alias.length < MINIMUM_ALIAS_LENGTH_FREE) {
    throw new Error(
      `Custom aliases must be at least ${MINIMUM_ALIAS_LENGTH_FREE} characters on the free plan. Upgrade to Pro for shorter aliases.`
    );
  }

  return checkAliasAvailability(ctx, alias, domain);
};

export const checkAliasAvailability = async (
  ctx: ProtectedTRPCContext,
  alias: string,
  domain: string,
): Promise<void> => {
  const normalizedAlias = normalizeAlias(alias);
  const aliasExists = await ctx.db
    .select()
    .from(link)
    .where(and(sql`lower(${link.alias}) = ${normalizedAlias}`, eq(link.domain, domain)));

  if (aliasExists.length) {
    throw new Error("Alias already exists");
  }
};

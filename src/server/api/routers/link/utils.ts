import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";

import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { redis } from "@/lib/core/cache";
import { normalizeAlias, parseReferrer } from "@/lib/utils";
import { isBot } from "@/lib/utils/is-bot";
import { link, linkVisit, uniqueLinkVisit, user } from "@/server/db/schema";
import { getUserPlanContext, normalizeMonthlyLinkCount } from "@/server/lib/user-plan";
import { registerEventUsage } from "@/server/lib/event-usage";
import { sendEventUsageEmail } from "@/server/lib/notifications/event-usage";

import type { Link } from "@/server/db/schema";
import type { ProtectedTRPCContext, PublicTRPCContext } from "../../trpc";
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

export const validateAlias = (
  ctx: ProtectedTRPCContext,
  alias: string,
  domain: string,
): Promise<void> => {
  const aliasRegex = /^[a-zA-Z0-9-_]+$/;

  if (!aliasRegex.test(alias)) {
    throw new Error("Alias can only contain alphanumeric characters, dashes, and underscores");
  }

  if (alias.includes(".")) {
    throw new Error("Cannot include periods in alias");
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

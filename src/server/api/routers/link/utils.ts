import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";

import { retrieveDeviceAndGeolocationData } from "@/lib/core/analytics";
import { redis } from "@/lib/core/cache";
import { normalizeAlias, parseReferrer } from "@/lib/utils";
import { isBot } from "@/lib/utils/is-bot";
import { link, linkVisit, uniqueLinkVisit, user } from "@/server/db/schema";

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
  const userInfo = await ctx.db.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, ctx.auth.userId),
    with: {
      subscriptions: true,
    },
  });

  const userSubscription = userInfo?.subscriptions;
  const isProUser = userSubscription?.status === "active";

  if (isProUser) {
    return {
      isProUser: true,
      currentCount: userInfo?.monthlyLinkCount ?? 0,
    };
  }

  let currentCount = userInfo?.monthlyLinkCount ?? 0;
  const lastReset = userInfo?.lastLinkCountReset;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (!lastReset || lastReset < monthStart) {
    await ctx.db
      .update(user)
      .set({
        monthlyLinkCount: 0,
        lastLinkCountReset: now,
      })
      .where(eq(user.id, ctx.auth.userId));
    currentCount = 0;
  }

  if (currentCount >= 30) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You've reached your monthly limit of 30 links. Upgrade to Pro for unlimited links!",
    });
  }

  return {
    isProUser: false,
    currentCount,
  };
}

export async function incrementLinkCount(
  ctx: ProtectedTRPCContext,
  currentCount: number,
  isProUser: boolean,
) {
  if (!isProUser) {
    await ctx.db
      .update(user)
      .set({
        monthlyLinkCount: currentCount + 1,
      })
      .where(eq(user.id, ctx.auth.userId));
  }
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

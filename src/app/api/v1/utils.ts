import { eq } from "drizzle-orm";
import crypto from "node:crypto";

import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { db } from "@/server/db";
import { siteSettings, subscription, token, user } from "@/server/db/schema";

export async function validateAndGetToken(apiKey: string | null) {
  if (!apiKey) return null;
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const existingToken = await db.select().from(token).where(eq(token.token, hash));

  if (!existingToken.length) return null;

  const userId = existingToken[0]!.userId;

  // Run ban check and subscription lookup in parallel
  const [userRecord, userSubscription] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: { banned: true },
    }),
    db.select().from(subscription).where(eq(subscription.userId, userId)),
  ]);

  if (userRecord?.banned) {
    return null;
  }

  return { ...existingToken[0]!, subscription: userSubscription[0] };
}

function normalizeApiDomain(domain: string | null | undefined) {
  const normalized = domain?.trim().replace(/\.$/, "").toLowerCase();
  return normalized || null;
}

async function getUserDefaultDomain(userId: string) {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.userId, userId),
    columns: {
      defaultDomain: true,
    },
  });

  return normalizeApiDomain(settings?.defaultDomain) ?? DEFAULT_PLATFORM_DOMAIN;
}

export async function resolveApiDomainForUser(
  userId: string,
  input: {
    domain?: string | null;
  },
) {
  const explicitDomain = normalizeApiDomain(input.domain);

  if (explicitDomain) {
    return explicitDomain;
  }

  return getUserDefaultDomain(userId);
}

export function getApiDomainParamsFromSearchParams(searchParams: URLSearchParams) {
  return {
    domain: searchParams.get("domain"),
  };
}

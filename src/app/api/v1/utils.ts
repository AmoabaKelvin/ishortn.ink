import crypto from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { resolvePlan } from "@/lib/billing/plans";
import { DEFAULT_PLATFORM_DOMAIN, isPlatformDomain } from "@/lib/constants/domains";
import { db } from "@/server/db";
import { customDomain, siteSettings, subscription, token, user } from "@/server/db/schema";

import { consumeApiRateLimit, rateLimitedResponse, rateLimitHeaders } from "./rate-limit";

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
      columns: { banned: true, deletedAt: true },
    }),
    db.select().from(subscription).where(eq(subscription.userId, userId)),
  ]);

  if (userRecord?.banned || userRecord?.deletedAt) {
    return null;
  }

  return { ...existingToken[0]!, subscription: userSubscription[0] };
}

export type ApiToken = NonNullable<Awaited<ReturnType<typeof validateAndGetToken>>>;

/**
 * Wraps a v1 route handler with API key auth and the plan's rate limit. The
 * limit is checked after auth (it needs the plan) and every response carries
 * the X-RateLimit-* headers.
 */
export function withApiKey<Req extends Request, Args extends unknown[]>(
  handler: (request: Req, token: ApiToken, ...args: Args) => Promise<Response>,
) {
  return async (request: Req, ...args: Args): Promise<Response> => {
    const token = await validateAndGetToken(request.headers.get("x-api-key"));
    if (!token) {
      return new Response("Invalid or missing API key", { status: 401 });
    }

    const decision = await consumeApiRateLimit(
      token.userId,
      resolvePlan(token.subscription ?? null),
    );
    if (!decision.allowed) return rateLimitedResponse(decision);

    const response = await handler(request, token, ...args);
    for (const [name, value] of Object.entries(rateLimitHeaders(decision))) {
      response.headers.set(name, value);
    }
    return response;
  };
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

/**
 * Resolves the domain a v1 API request operates on. An explicit `domain` is
 * attacker-controlled, so it is only honored when it is a platform domain or an
 * active custom domain in the token owner's personal workspace — API links are
 * always created there (no teamId). Returns null when the requested domain is
 * not one of those; without this check a token holder could read, modify, or
 * mint links on any other account's branded domain.
 */
export async function resolveApiDomainForUser(
  userId: string,
  input: {
    domain?: string | null;
  },
) {
  const explicitDomain = normalizeApiDomain(input.domain);

  if (explicitDomain) {
    if (isPlatformDomain(explicitDomain)) return explicitDomain;

    const owned = await db.query.customDomain.findFirst({
      where: and(
        sql`lower(${customDomain.domain}) = ${explicitDomain}`,
        eq(customDomain.status, "active"),
        eq(customDomain.userId, userId),
        isNull(customDomain.teamId),
      ),
      columns: { id: true },
    });

    if (!owned) return null;

    return explicitDomain;
  }

  return getUserDefaultDomain(userId);
}

export function getApiDomainParamsFromSearchParams(searchParams: URLSearchParams) {
  return {
    domain: searchParams.get("domain"),
  };
}

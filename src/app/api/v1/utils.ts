import crypto from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { canUseApi, getApiAccess } from "@/lib/billing/api-access";
import { effectivePlan, graceUsagePlan } from "@/lib/billing/entitlements";
import { getPlanCaps } from "@/lib/billing/plans";
import {
  DEFAULT_PLATFORM_DOMAIN,
  isPlatformDomain,
  PLATFORM_DOMAINS,
} from "@/lib/constants/domains";
import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/constants/moderation";
import { runBackgroundTask } from "@/lib/utils/background";
import { domainBeyondPlanMessage, getUsableCustomDomains } from "@/server/api/routers/link/utils";
import { db } from "@/server/db";
import { customDomain, siteSettings, subscription, token, user } from "@/server/db/schema";
import { getApiSunset } from "@/server/lib/api-access";
import { ensurePlanChecked } from "@/server/lib/entitlements/grace";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";

import { apiAccessRevokedResponse, withApiSunsetNotice } from "./api-access";
import { apiError } from "./errors";
import { consumeApiRateLimit, rateLimitedResponse, rateLimitHeaders } from "./rate-limit";

import type { Plan } from "@/lib/billing/plans";

// Bounds the write load from busy keys: lastUsedAt is only for display.
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

/**
 * Loads the token and its owner's plan. `kind` keeps the two token types on their own routes:
 * extension tokens exist on every plan, so /api/v1 (a paid feature) must refuse them.
 */
export async function validateAndGetToken(
  apiKey: string | null,
  kind: "api" | "extension" = "api",
) {
  if (!apiKey) return null;
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const existingToken = await db
    .select()
    .from(token)
    .where(and(eq(token.token, hash), eq(token.kind, kind)));

  if (!existingToken.length) return null;

  const userId = existingToken[0]!.userId;

  // Run ban/restriction check and subscription lookup in parallel
  const [userRecord, userSubscription] = await Promise.all([
    db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        id: true,
        banned: true,
        deletedAt: true,
        restrictedAt: true,
        planGracePlan: true,
        planGraceEndsAt: true,
        planGraceReason: true,
        planCheckedAt: true,
      },
    }),
    db.select().from(subscription).where(eq(subscription.userId, userId)),
  ]);

  if (!userRecord || userRecord.banned || userRecord.deletedAt) {
    return null;
  }

  const now = new Date();
  const { id, lastUsedAt } = existingToken[0]!;
  if (!lastUsedAt || now.getTime() - lastUsedAt.getTime() >= LAST_USED_RESOLUTION_MS) {
    void runBackgroundTask(db.update(token).set({ lastUsedAt: now }).where(eq(token.id, id))).catch(
      () => undefined,
    );
  }

  const userSub = userSubscription[0] ?? null;
  // The same entitlement the dashboard uses: API links live in the personal workspace.
  // Every paid-feature check in v1 reads this plan, so a trialing, past-due or
  // cancelled-but-paid-up subscriber gets the same access as in the dashboard.
  const grace = await ensurePlanChecked(userRecord, userSub);
  return {
    ...existingToken[0]!,
    subscription: userSub,
    grace,
    plan: effectivePlan(userSub, grace),
    // Existing usage (domains past the allowance) during an over-plan grace.
    graceUsagePlan: graceUsagePlan(userSub, grace),
    restrictedAt: userRecord.restrictedAt ?? null,
  };
}

export type ApiToken = NonNullable<Awaited<ReturnType<typeof validateAndGetToken>>>;

/** 403 for write routes when the token owner's account is restricted, else null. */
export function restrictedAccountResponse(token: ApiToken): Response | null {
  return token.restrictedAt ? apiError(403, "forbidden", ACCOUNT_RESTRICTED_MESSAGE) : null;
}

/**
 * Wraps a v1 route handler with API key auth, the plan's API access and its
 * rate limit. The limit is checked after auth (it needs the plan) and every
 * response carries the X-RateLimit-* headers. Keys on accounts without a paid
 * plan get 403 after their sunset and the sunset headers until then.
 */
export function withApiKey<Req extends Request, Args extends unknown[]>(
  handler: (request: Req, token: ApiToken, ...args: Args) => Promise<Response>,
) {
  return async (request: Req, ...args: Args): Promise<Response> => {
    const token = await validateAndGetToken(request.headers.get("x-api-key"));
    if (!token) {
      return apiError(401, "unauthorized", "Invalid or missing API key");
    }

    // Paid keys skip the sunset lookup; for the rest it's cached per isolate.
    const sunsetAt = canUseApi(token.plan) ? null : await getApiSunset();
    const access = getApiAccess(token.subscription, token.grace, sunsetAt, new Date());
    if (access.status === "revoked") {
      await recordPlanLimitHit({ userId: token.userId, limitKey: "api_v1", plan: token.plan });
      return apiAccessRevokedResponse();
    }

    const decision = await consumeApiRateLimit(token.userId, token.plan);
    if (!decision.allowed) return withApiSunsetNotice(rateLimitedResponse(decision), access);

    const response = await handler(request, token, ...args);
    for (const [name, value] of Object.entries(rateLimitHeaders(decision))) {
      response.headers.set(name, value);
    }
    return withApiSunsetNotice(response, access);
  };
}

function normalizeApiDomain(domain: string | null | undefined) {
  const normalized = domain?.trim().replace(/\.$/, "").toLowerCase();
  return normalized || null;
}

export async function getUserDefaultDomain(userId: string) {
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

/**
 * Every domain resolveApiDomainForUser accepts for this user: the platform
 * domains plus the active custom domains in their personal workspace.
 */
export async function getApiReadableDomains(userId: string) {
  const owned = await db
    .select({ domain: customDomain.domain })
    .from(customDomain)
    .where(
      and(
        eq(customDomain.status, "active"),
        eq(customDomain.userId, userId),
        isNull(customDomain.teamId),
      ),
    );
  return [...PLATFORM_DOMAINS, ...owned.flatMap((row) => row.domain ?? [])];
}

/**
 * Write-path counterpart of resolveApiDomainForUser: custom domains past the
 * plan's allowance (oldest first, see getUsableCustomDomains) keep serving their
 * links but take no new or edited ones. Returns the refusal message, or null.
 */
export async function apiDomainWriteError(
  userId: string,
  plan: Plan,
  domain: string,
): Promise<string | null> {
  if (isPlatformDomain(domain)) return null;
  const limit = getPlanCaps(plan).domainLimit;
  if (limit === undefined) return null;

  const usable = await getUsableCustomDomains(
    db,
    and(eq(customDomain.userId, userId), isNull(customDomain.teamId)),
    limit,
  );
  return usable.includes(domain.toLowerCase()) ? null : domainBeyondPlanMessage(domain, limit);
}

export function getApiDomainParamsFromSearchParams(searchParams: URLSearchParams) {
  return {
    domain: searchParams.get("domain"),
  };
}

/** The public shape of a link in v1 responses; never includes the password hash. */
export function toApiLink(retrievedLink: {
  id: number;
  createdAt: Date | null;
  domain: string;
  alias: string | null;
  url: string | null;
  disableLinkAfterDate: Date | null;
  activateAt: Date | null;
  disableLinkAfterClicks: number | null;
}) {
  return {
    // Stable across renames, so integrations can dedupe on it instead of shortLink.
    id: retrievedLink.id,
    shortLink: `https://${retrievedLink.domain}/${retrievedLink.alias}`,
    url: retrievedLink.url,
    alias: retrievedLink.alias,
    createdAt: retrievedLink.createdAt,
    expiresAt: retrievedLink.disableLinkAfterDate,
    activatesAt: retrievedLink.activateAt,
    expiresAfter: retrievedLink.disableLinkAfterClicks,
  };
}

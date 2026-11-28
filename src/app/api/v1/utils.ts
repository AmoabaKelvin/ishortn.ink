import crypto from "node:crypto";

import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";

import { canUseApi, getApiAccess } from "@/lib/billing/api-access";
import { effectivePlan, graceUsagePlan, teamAccess } from "@/lib/billing/entitlements";
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
import {
  customDomain,
  link,
  siteSettings,
  subscription,
  team,
  token,
  user,
} from "@/server/db/schema";
import { getApiSunset } from "@/server/lib/api-access";
import { ensurePlanChecked } from "@/server/lib/entitlements/grace";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";

import { apiAccessRevokedResponse, withApiSunsetNotice } from "./api-access";
import { apiError } from "./errors";
import {
  applyApiRateLimit,
  rateLimitedResponse,
  rateLimitHeaders,
  readApiRateLimitCounters,
} from "./rate-limit";

import type { ApiAccess } from "@/lib/billing/api-access";
import type { Plan } from "@/lib/billing/plans";
import type { SafetyAccount } from "@/server/lib/phishing";
import type { ServerTiming } from "@/server/lib/server-timing";
import type { WorkspaceContext } from "@/server/lib/workspace";
import type { MySqlColumn } from "drizzle-orm/mysql-core";

// Bounds the write load from busy keys: lastUsedAt is only for display.
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

// The key's creator; on team keys only their restriction is read (see resolveTokenPlan).
const creator = alias(user, "creator");

/**
 * The token row, the owner's auth columns and their subscription in one round trip, or null
 * for an unknown token or a banned or deleted owner. The owner is the creator for a personal key
 * and the team's owner for a team key, whose plan the team runs on. `kind` keeps the two token
 * types on their own routes: extension tokens exist on every plan, so /api/v1 (a paid feature)
 * must refuse them.
 */
async function findToken(apiKey: string | null, kind: "api" | "extension") {
  if (!apiKey) return null;
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const [row] = await db
    .select({
      token,
      team,
      creatorRestrictedAt: creator.restrictedAt,
      owner: {
        id: user.id,
        banned: user.banned,
        deletedAt: user.deletedAt,
        restrictedAt: user.restrictedAt,
        planGracePlan: user.planGracePlan,
        planGraceEndsAt: user.planGraceEndsAt,
        planGraceReason: user.planGraceReason,
        planCheckedAt: user.planCheckedAt,
        // For /api/extension/me, so it needn't load the user again.
        email: user.email,
        monthlyLinkCount: user.monthlyLinkCount,
        lastLinkCountReset: user.lastLinkCountReset,
        createdAt: user.createdAt,
        // For the default domain of link creates; a subquery, not a join, so stray extra
        // settings rows can't multiply the token row.
        defaultDomain: sql<
          string | null
        >`(select ${siteSettings.defaultDomain} from ${siteSettings} where ${siteSettings.userId} = ${token.userId} limit 1)`,
      },
      subscription,
    })
    .from(token)
    .leftJoin(team, eq(team.id, token.teamId))
    // A team key whose team row is gone falls back to its creator here; resolveTokenPlan
    // refuses it either way.
    .innerJoin(user, eq(user.id, sql`coalesce(${team.ownerId}, ${token.userId})`))
    .leftJoin(creator, eq(creator.id, token.userId))
    .leftJoin(subscription, eq(subscription.userId, user.id))
    .where(and(eq(token.token, hash), eq(token.kind, kind)))
    .limit(1);

  if (!row || row.owner.banned || row.owner.deletedAt) return null;

  const now = new Date();
  const { id, lastUsedAt } = row.token;
  if (!lastUsedAt || now.getTime() - lastUsedAt.getTime() >= LAST_USED_RESOLUTION_MS) {
    void runBackgroundTask(db.update(token).set({ lastUsedAt: now }).where(eq(token.id, id))).catch(
      () => undefined,
    );
  }
  return row;
}

/** Where a key acts, as /api/v1/me reports it. */
export type ApiWorkspace =
  | { type: "personal" }
  | { type: "team"; id: number; name: string; slug: string };

async function resolveTokenPlan({
  token: tokenRow,
  team: teamRow,
  creatorRestrictedAt,
  owner,
  subscription: userSub,
}: NonNullable<Awaited<ReturnType<typeof findToken>>>) {
  // The same entitlement the dashboard uses. Every paid-feature check in v1 reads this plan,
  // so a trialing, past-due or cancelled-but-paid-up subscriber gets the same access as in the
  // dashboard.
  const grace = await ensurePlanChecked(owner, userSub);
  const ownerPlan = effectivePlan(userSub, grace);
  const activeTeam = tokenRow.teamId !== null && teamRow && !teamRow.deletedAt ? teamRow : null;
  // Team keys run on the team's entitlement: Ultra while the owner has it or the team grace
  // lasts. A deleted team or one past its grace (read-only in the dashboard) disables them.
  const access = activeTeam ? teamAccess(ownerPlan, activeTeam.ownerPlanGraceEndsAt) : null;
  const plan = access ? access.plan : ownerPlan;
  const workspace: ApiWorkspace = activeTeam
    ? { type: "team", id: activeTeam.id, name: activeTeam.name, slug: activeTeam.slug }
    : { type: "personal" };
  return {
    ...tokenRow,
    team: activeTeam,
    workspace,
    teamKeyDisabled: tokenRow.teamId !== null && (!access || access.readOnly),
    subscription: userSub,
    grace,
    plan,
    // Existing usage (domains past the allowance) during an over-plan grace.
    graceUsagePlan: access ? plan : graceUsagePlan(userSub, grace),
    restrictedAt: owner.restrictedAt ?? (activeTeam ? creatorRestrictedAt : null) ?? null,
    owner: {
      email: owner.email,
      monthlyLinkCount: owner.monthlyLinkCount,
      lastLinkCountReset: owner.lastLinkCountReset,
      createdAt: owner.createdAt,
    },
    defaultDomain:
      normalizeApiDomain(activeTeam ? activeTeam.defaultDomain : owner.defaultDomain) ??
      DEFAULT_PLATFORM_DOMAIN,
  };
}

/**
 * Loads the token with its owner's plan, and the owner's rate-limit counters; null for an
 * unknown token or a banned or deleted owner. The counter read needs only the user id, so it
 * starts right after the token query and overlaps the rest of auth instead of following it.
 */
export async function authenticateToken(apiKey: string | null, kind: "api" | "extension") {
  const row = await findToken(apiKey, kind);
  if (!row) return null;
  // Team keys share one budget per team, apart from their creators' personal keys.
  const counters = readApiRateLimitCounters(
    row.token.teamId === null ? row.token.userId : `team:${row.token.teamId}`,
  );
  const token = await resolveTokenPlan(row);
  return { token, counters };
}

export type ApiToken = Awaited<ReturnType<typeof resolveTokenPlan>>;

/** The account whose links a key writes: the owner's personal account, or the team. */
export function apiSafetyAccount(token: ApiToken): SafetyAccount {
  return { plan: token.plan, isTeam: !!token.team, createdAt: async () => token.owner.createdAt };
}

/**
 * The workspace a key acts in, for services shared with the dashboard. A team key acts with
 * admin rights (only owners and admins create them), so it reaches every team folder.
 */
export function apiWorkspaceContext(token: ApiToken): WorkspaceContext {
  if (!token.team) {
    return {
      type: "personal",
      userId: token.userId,
      teamId: null,
      teamSlug: null,
      role: "owner",
      plan: token.plan,
      graceUsagePlan: token.graceUsagePlan,
    };
  }
  return {
    type: "team",
    userId: token.userId,
    teamId: token.team.id,
    teamSlug: token.team.slug,
    team: token.team,
    membership: {
      id: 0,
      teamId: token.team.id,
      userId: token.userId,
      role: "admin",
      createdAt: null,
      updatedAt: null,
    },
    role: "admin",
    plan: token.plan,
    readOnly: false,
    ownerGraceEndsAt: token.team.ownerPlanGraceEndsAt,
  };
}

/** 403 for write routes when the token owner's account is restricted, else null. */
export function restrictedAccountResponse(token: ApiToken): Response | null {
  return token.restrictedAt ? apiError(403, "forbidden", ACCOUNT_RESTRICTED_MESSAGE) : null;
}

/**
 * Wraps a v1 route handler with API key auth, the plan's API access and its
 * rate limit. The limit is checked after auth (it needs the plan) and every
 * response carries the X-RateLimit-* headers. Keys on accounts without a paid
 * plan get 403 after their sunset and the sunset headers until then. The auth time goes to
 * `serverTiming` as `auth` when given.
 */
export function withApiKey<Req extends Request, Args extends unknown[]>(
  handler: (request: Req, token: ApiToken, ...args: Args) => Promise<Response>,
  serverTiming?: ServerTiming,
) {
  return async (request: Req, ...args: Args): Promise<Response> => {
    const started = Date.now();
    const authDone = () => serverTiming?.add("auth", Date.now() - started);
    const auth = await authenticateToken(request.headers.get("x-api-key"), "api");
    if (!auth) {
      authDone();
      return apiError(401, "unauthorized", "Invalid or missing API key");
    }
    const { token } = auth;

    if (token.teamKeyDisabled) {
      await recordPlanLimitHit({ userId: token.userId, limitKey: "api_v1", plan: token.plan });
      authDone();
      return apiAccessRevokedResponse();
    }

    // Paid keys skip the sunset lookup; for the rest it's cached per isolate. A team key that
    // got here runs on the team's Ultra, whatever the owner's own subscription says.
    const sunsetAt = canUseApi(token.plan) ? null : await getApiSunset();
    const access: ApiAccess = token.team
      ? { status: "full" }
      : getApiAccess(token.subscription, token.grace, sunsetAt, new Date());
    if (access.status === "revoked") {
      await recordPlanLimitHit({ userId: token.userId, limitKey: "api_v1", plan: token.plan });
      authDone();
      return apiAccessRevokedResponse();
    }

    const decision = applyApiRateLimit(await auth.counters, token.plan);
    authDone();
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

/** The workspace a key reads and writes: the creator's personal one, or its team. */
export type ApiScope = Pick<ApiToken, "userId" | "teamId" | "defaultDomain">;

/** `workspaceFilter` for a key: `teamId = <team>` for team keys, else the personal rows. */
function scopeFilter(
  scope: Pick<ApiScope, "userId" | "teamId">,
  columns: { userId: MySqlColumn; teamId: MySqlColumn },
) {
  return scope.teamId !== null
    ? eq(columns.teamId, scope.teamId)
    : and(eq(columns.userId, scope.userId), isNull(columns.teamId));
}

/** The links a key may reach (before the domain check). */
export function apiLinkFilter(scope: Pick<ApiScope, "userId" | "teamId">) {
  return scopeFilter(scope, link);
}

function apiCustomDomainFilter(scope: Pick<ApiScope, "userId" | "teamId">) {
  return scopeFilter(scope, customDomain);
}

/**
 * Resolves the domain a v1 API request operates on. An explicit `domain` is
 * attacker-controlled, so it is only honored when it is a platform domain or an
 * active custom domain in the key's workspace (the creator's personal workspace,
 * or the key's team). Returns null when the requested domain is not one of those;
 * without this check a token holder could read, modify, or mint links on any other
 * account's branded domain. Without a `domain` it is the workspace's default.
 */
export async function resolveApiDomainForUser(
  scope: ApiScope,
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
        apiCustomDomainFilter(scope),
      ),
      columns: { id: true },
    });

    if (!owned) return null;

    return explicitDomain;
  }

  return scope.defaultDomain;
}

/**
 * Every domain resolveApiDomainForUser accepts for this key: the platform
 * domains plus the active custom domains in its workspace.
 */
export async function getApiReadableDomains(scope: Pick<ApiScope, "userId" | "teamId">) {
  const owned = await activeScopeDomains(scope);
  return [...PLATFORM_DOMAINS, ...owned.flatMap((row) => row.domain ?? [])];
}

/**
 * getApiReadableDomains as a `link.domain` condition with the custom domains in a
 * subquery, so the link lookup needs no separate round trip for them.
 */
export function apiReadableLinkDomain(scope: Pick<ApiScope, "userId" | "teamId">) {
  return or(
    inArray(link.domain, PLATFORM_DOMAINS),
    inArray(link.domain, activeScopeDomains(scope)),
  );
}

function activeScopeDomains(scope: Pick<ApiScope, "userId" | "teamId">) {
  return db
    .select({ domain: customDomain.domain })
    .from(customDomain)
    .where(and(eq(customDomain.status, "active"), apiCustomDomainFilter(scope)));
}

/**
 * Write-path counterpart of resolveApiDomainForUser: custom domains past the
 * plan's allowance (oldest first, see getUsableCustomDomains) keep serving their
 * links but take no new or edited ones. Returns the refusal message, or null.
 */
export async function apiDomainWriteError(
  scope: Pick<ApiScope, "userId" | "teamId">,
  plan: Plan,
  domain: string,
): Promise<string | null> {
  if (isPlatformDomain(domain)) return null;
  const limit = getPlanCaps(plan).domainLimit;
  if (limit === undefined) return null;

  const usable = await getUsableCustomDomains(db, apiCustomDomainFilter(scope), limit);
  return usable.includes(domain.toLowerCase()) ? null : domainBeyondPlanMessage(domain, limit);
}

export function getApiDomainParamsFromSearchParams(searchParams: URLSearchParams) {
  return {
    domain: searchParams.get("domain"),
  };
}

export { toApiLink } from "@/server/lib/api-link";

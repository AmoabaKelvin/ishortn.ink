import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getBioLinkBlockLimit, getPlanCaps } from "@/lib/billing/plans";
import { DEFAULT_PLATFORM_DOMAIN, isPlatformDomain } from "@/lib/constants/domains";
import { getStringFromCache, setStringInCache } from "@/lib/core/cache";
import { normalizeAlias } from "@/lib/utils";
import { customDomain, link, team, user } from "@/server/db/schema";
import {
  getUserPlanContext,
  monthlyLinkLimitMessage,
  normalizeMonthlyLinkCount,
} from "@/server/lib/user-plan";
import { requireFolderAccess, workspaceFilter } from "@/server/lib/workspace";

import type { ProtectedTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type { Plan } from "@/lib/billing/plans";
import type { Link } from "@/server/db/schema";
import type { SQL } from "drizzle-orm";

/**
 * Loads a link that belongs to the caller's workspace, and — when the link
 * lives in a folder — that the caller is allowed to see that folder. Workspace
 * scoping alone is not enough: team folders can be restricted to a subset of
 * members, and every satellite router (tags, geo rules, milestones) authorizes
 * through this helper.
 */
export async function verifyLinkOwnership(ctx: WorkspaceTRPCContext, linkId: number) {
  const linkRecord = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, linkId), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
  });

  if (!linkRecord) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Link not found or you don't have access to it",
    });
  }

  if (linkRecord.folderId) {
    await requireFolderAccess(ctx.db, ctx.workspace, linkRecord.folderId);
  }

  return linkRecord;
}

/**
 * On plans that cap link blocks per bio page (free), bio link blocks are
 * limited by that cap (`lockBioLinkBlockCapacity`) instead, so they neither
 * consume nor are blocked by the monthly link quota. Uncapped plans count them
 * like any other link, or they would escape the monthly quota entirely.
 */
export function countsTowardMonthlyLinkQuota(
  plan: Plan,
  values: { isBioLink?: boolean | null },
): boolean {
  return values.isBioLink !== true || getBioLinkBlockLimit(plan) === undefined;
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
    throw new TRPCError({
      code: "FORBIDDEN",
      message: monthlyLinkLimitMessage(plan, limit),
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
  // Team workspaces carry the owner's plan; a team below Ultra is read-only
  // (refused in workspaceProcedure), so a writable team is never capped here.
  if (ctx.workspace.type === "team") {
    return {
      plan: ctx.workspace.plan,
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
  limit?: number,
  created = 1,
) {
  if (limit === undefined) {
    return;
  }

  await ctx.db
    .update(user)
    .set({
      monthlyLinkCount: currentCount + created,
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
  limit?: number,
  created = 1,
) {
  // Don't track usage for team workspaces
  if (ctx.workspace.type === "team") {
    return;
  }

  return incrementLinkCount(ctx, currentCount, limit, created);
}

export async function getUserDefaultDomain(ctx: ProtectedTRPCContext): Promise<string> {
  const cacheKey = `user_settings_domain:${ctx.auth.userId}`;
  const cachedDomain = await getStringFromCache(cacheKey);

  if (cachedDomain) {
    return cachedDomain ?? DEFAULT_PLATFORM_DOMAIN;
  }

  const userInfo = await ctx.db.query.user.findFirst({
    where: (table, { eq }) => eq(table.id, ctx.auth.userId),
    with: {
      siteSettings: true,
    },
  });

  const defaultDomain = userInfo?.siteSettings?.defaultDomain ?? DEFAULT_PLATFORM_DOMAIN;
  await setStringInCache(cacheKey, defaultDomain, 300); // 5 minutes

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
    const cachedDomain = await getStringFromCache(cacheKey);

    if (cachedDomain) {
      return cachedDomain;
    }

    // Get team's default domain from the team record
    const teamRecord = await ctx.db.query.team.findFirst({
      where: eq(team.id, ctx.workspace.teamId),
    });

    const defaultDomain = teamRecord?.defaultDomain ?? DEFAULT_PLATFORM_DOMAIN;
    await setStringInCache(cacheKey, defaultDomain, 300); // 5 minutes

    return defaultDomain;
  }

  // Personal workspace: use user's default domain
  return getUserDefaultDomain(ctx);
}

/**
 * Guards against clients submitting arbitrary `domain` values on link/QR
 * writes. Accepts platform-owned domains, or custom domains that are both
 * verified ("active") and scoped to the caller's workspace. Throws on
 * anything else — DNS is case-insensitive, so we normalize before lookup.
 */
export async function assertDomainAllowed(
  ctx: WorkspaceTRPCContext,
  domain: string,
): Promise<void> {
  const normalized = domain.trim().toLowerCase();
  if (isPlatformDomain(normalized)) return;

  const scope = workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId);
  const owned = await ctx.db.query.customDomain.findFirst({
    where: and(
      sql`lower(${customDomain.domain}) = ${normalized}`,
      eq(customDomain.status, "active"),
      scope,
    ),
  });

  if (!owned) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Selected domain is not available for this workspace.",
    });
  }

  await assertDomainWithinPlan(ctx, normalized);
}

/**
 * Like assertDomainAllowed for a link that already sits on `domain`: only the
 * plan allowance is checked, so links on a domain whose verification later
 * lapsed can still be edited.
 */
export async function assertDomainWithinPlan(
  ctx: WorkspaceTRPCContext,
  domain: string,
): Promise<void> {
  const normalized = domain.trim().toLowerCase();
  if (isPlatformDomain(normalized)) return;

  const limit = getPlanCaps(ctx.workspace.plan).domainLimit;
  if (limit === undefined) return;

  const scope = workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId);
  const usable = await getUsableCustomDomains(ctx.db, scope, limit);
  if (!usable.includes(normalized)) {
    throw new TRPCError({ code: "FORBIDDEN", message: domainBeyondPlanMessage(normalized, limit) });
  }
}

/**
 * The custom domains (lowercased) within the plan's allowance: the workspace's
 * oldest `limit` domains, whatever their verification status, matching how the
 * domain cap counts them. Domains past the allowance (after a downgrade) keep
 * redirecting their existing links but take no new or edited ones. New links
 * also need the domain to be verified (assertDomainAllowed).
 */
export async function getUsableCustomDomains(
  dbClient: Pick<ProtectedTRPCContext, "db">["db"],
  scope: SQL | undefined,
  limit: number,
): Promise<string[]> {
  if (limit <= 0) return [];
  const rows = await dbClient
    .select({ domain: customDomain.domain })
    .from(customDomain)
    .where(scope)
    .orderBy(asc(customDomain.createdAt), asc(customDomain.id))
    .limit(limit);
  return rows.flatMap((row) => (row.domain ? [row.domain.toLowerCase()] : []));
}

export function domainBeyondPlanMessage(domain: string, limit: number): string {
  if (limit === 0) {
    return `Custom domains are available on Pro and Ultra. Upgrade to create or edit links on ${domain}.`;
  }
  return `Your plan includes ${limit} custom ${limit === 1 ? "domain" : "domains"}, so ${domain} can't take new or edited links. Upgrade to Ultra to keep using it.`;
}

type UtmParams = Link["utmParams"];

export function hasUtmValues(params: UtmParams | undefined): boolean {
  return Object.values(params ?? {}).some((value) => value !== undefined && value !== "");
}

/** Same UTM values, ignoring empty fields. */
export function sameUtmParams(a: UtmParams | undefined, b: UtmParams | undefined): boolean {
  const filled = (params: UtmParams | undefined) =>
    JSON.stringify(
      Object.entries(params ?? {})
        .filter(([, value]) => value !== undefined && value !== "")
        .sort(([x], [y]) => x.localeCompare(y)),
    );
  return filled(a) === filled(b);
}

type TargetingRuleFields = {
  type: string;
  condition: string;
  values: string[];
  action: string;
  destination?: string | null;
  blockMessage?: string | null;
};

/** Same targeting rules in the same order (stored rules sorted by priority). */
export function sameGeoRules(input: TargetingRuleFields[], stored: TargetingRuleFields[]): boolean {
  const normalize = (rule: TargetingRuleFields) =>
    JSON.stringify([
      rule.type,
      rule.condition,
      rule.values,
      rule.action,
      rule.action === "redirect" ? rule.destination || null : null,
      rule.action === "block" ? rule.blockMessage || null : null,
    ]);
  return (
    input.length === stored.length &&
    input.every((rule, index) => normalize(rule) === normalize(stored[index]!))
  );
}

export const MINIMUM_ALIAS_LENGTH_FREE = 6;

export const validateAlias = (
  ctx: Pick<ProtectedTRPCContext, "db">,
  alias: string,
  domain: string,
  isPaidUser = false,
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
      `Custom aliases must be at least ${MINIMUM_ALIAS_LENGTH_FREE} characters on the free plan. Upgrade to Pro for shorter aliases.`,
    );
  }

  return checkAliasAvailability(ctx, alias, domain);
};

export const checkAliasAvailability = async (
  ctx: Pick<ProtectedTRPCContext, "db">,
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

const publicLinkMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
});

/**
 * The only link fields an unauthenticated caller may see: enough to render
 * social previews and route to the right interstitial. The destination,
 * password hash, owner, note and UTM params stay on the server.
 */
export type PublicLink = {
  id: number;
  alias: string | null;
  domain: string;
  metadata: z.infer<typeof publicLinkMetadataSchema>;
  blocked: boolean;
  disabled: boolean;
  disableLinkAfterDate: Date | null;
  activateAt: Date | null;
  hasPassword: boolean;
};

export function toPublicLink(row: Link): PublicLink {
  const metadata = publicLinkMetadataSchema.safeParse(row.metadata).data;
  return {
    id: row.id,
    alias: row.alias,
    domain: row.domain,
    metadata: {
      title: metadata?.title,
      description: metadata?.description,
      image: metadata?.image,
    },
    blocked: !!row.blocked,
    disabled: !!row.disabled,
    disableLinkAfterDate: row.disableLinkAfterDate,
    activateAt: row.activateAt,
    hasPassword: !!row.passwordHash,
  };
}

export const PASSWORD_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
// Per visitor IP, across links: the bound on guessing from one machine.
export const PASSWORD_ATTEMPTS_PER_IP = 10;
// Per link, across IPs: bounds distributed guessing. Higher than the per-IP
// limit so one visitor can't lock everyone else out of a link.
export const PASSWORD_ATTEMPTS_PER_LINK = 100;

/** Failed-attempt counter for a fixed window, stored in KV as `count:resetAtMs`. */
export type AttemptWindow = { count: number; resetAt: number };

export function readAttemptWindow(raw: string | null, now: number): AttemptWindow {
  const [count, resetAt] = (raw ?? "").split(":").map(Number);
  if (!count || !resetAt || resetAt <= now) {
    return { count: 0, resetAt: now + PASSWORD_ATTEMPT_WINDOW_MS };
  }
  return { count, resetAt };
}

export function recordFailedAttempt(window: AttemptWindow): string {
  return `${window.count + 1}:${window.resetAt}`;
}

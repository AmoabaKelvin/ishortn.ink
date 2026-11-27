import { TRPCError } from "@trpc/server";
import { CsvError, parse } from "csv-parse/sync";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { getBioLinkBlockLimit, getPlanCaps } from "@/lib/billing/plans";
import { DEFAULT_PLATFORM_DOMAIN, isPlatformDomain } from "@/lib/constants/domains";
import { formatReferrerLabel } from "@/lib/core/analytics/referrer";
import { getStringFromCache, setStringInCache } from "@/lib/core/cache";
import { APP_TOP_LEVEL_SEGMENTS } from "@/lib/seo/indexing";
import { normalizeAlias } from "@/lib/utils";
import { isBitlyExport } from "@/lib/utils/link-csv-headers";
import { customDomain, link, team, user } from "@/server/db/schema";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";
import { isAliasReserved } from "@/server/lib/reserved-alias";
import {
  getUserPlanContext,
  monthlyLinkLimitMessage,
  normalizeMonthlyLinkCount,
} from "@/server/lib/user-plan";
import { requireFolderAccess, workspaceFilter, workspaceUsagePlan } from "@/server/lib/workspace";

import type { ProtectedTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type { AllAnalyticsInput } from "./link.input";
import type { Plan } from "@/lib/billing/plans";
import type { Link } from "@/server/db/schema";
import type { SQL } from "drizzle-orm";

/** blockedReason for links a restricted account created; lifting the restriction restores them. */
export const RESTRICTED_LINK_REASON = "Owner account restricted" as const;

/**
 * Backstop for restricted accounts: contentWriteProcedure and the v1 API refuse
 * them, but a link one still manages to create through a path that skips the
 * gate is inserted already blocked. tRPC callers pass the request's
 * ctx.restrictedAt, so a restriction landing mid-request is not caught there;
 * the v1 API passes the value it re-reads while reserving the link slot.
 */
export function restrictedLinkValues(restrictedAt: Date | null | undefined) {
  if (!restrictedAt) return {};
  return { blocked: true, blockedAt: new Date(), blockedReason: RESTRICTED_LINK_REASON };
}

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

/**
 * Lifetime number of CSV-imported links on the workspace's own active custom
 * domain that skip the monthly link limit on capped paid plans. Moving a branded
 * domain from another shortener is migration, not new link creation, and would
 * otherwise take several months of allowance.
 */
export const CUSTOM_DOMAIN_IMPORT_ALLOWANCE = 5000;

/** What's left of CUSTOM_DOMAIN_IMPORT_ALLOWANCE; 0 on free and on uncapped plans. */
export function customDomainImportAllowanceLeft(
  plan: Plan,
  limit: number | undefined,
  used: number,
): number {
  if (plan === "free" || limit === undefined) return 0;
  return Math.max(0, CUSTOM_DOMAIN_IMPORT_ALLOWANCE - used);
}

type LinkLimitOptions = {
  /** CSV import: a used-up monthly limit doesn't reject while the import allowance remains. */
  customDomainImport?: boolean;
};

export async function checkAndUpdateLinkLimit(
  ctx: ProtectedTRPCContext,
  { customDomainImport = false }: LinkLimitOptions = {},
) {
  const planCtx = await getUserPlanContext(ctx.auth.userId, ctx.db);

  if (!planCtx) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  const { plan, linksLimit: limit } = planCtx;
  const currentCount = await normalizeMonthlyLinkCount(planCtx, ctx.db);
  const importAllowanceLeft = customDomainImport
    ? customDomainImportAllowanceLeft(plan, limit, planCtx.userRecord.customDomainImportCount)
    : 0;

  if (limit !== undefined && currentCount >= limit && importAllowanceLeft === 0) {
    await recordPlanLimitHit({ userId: ctx.auth.userId, limitKey: "monthly_links", plan });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: monthlyLinkLimitMessage(planCtx.plan, limit),
    });
  }

  return {
    plan,
    currentCount,
    limit,
    isProUser: plan !== "free",
    importAllowanceLeft,
  };
}

/**
 * Workspace-aware link limit check.
 * Team workspaces bypass limits (they're Ultra with unlimited links).
 * Personal workspaces check against the user's plan limits.
 */
export async function checkWorkspaceLinkLimit(
  ctx: WorkspaceTRPCContext,
  options: LinkLimitOptions = {},
) {
  // Team workspaces carry the owner's plan; a team below Ultra is read-only
  // (refused in workspaceProcedure), so a writable team is never capped here.
  if (ctx.workspace.type === "team") {
    return {
      plan: ctx.workspace.plan,
      currentCount: 0,
      limit: undefined,
      isProUser: true,
      importAllowanceLeft: 0,
    };
  }

  // Personal workspace: check user's plan limits
  return checkAndUpdateLinkLimit(ctx, options);
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

/** Counts created links against CUSTOM_DOMAIN_IMPORT_ALLOWANCE (personal workspaces only). */
export async function incrementCustomDomainImportCount(ctx: WorkspaceTRPCContext, created: number) {
  if (ctx.workspace.type === "team" || created === 0) return;

  await ctx.db
    .update(user)
    .set({ customDomainImportCount: sql`${user.customDomainImportCount} + ${created}` })
    .where(eq(user.id, ctx.auth.userId));
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
 * The workspace default domain when the plan still allows new links on it;
 * otherwise the platform default. A lapsed account whose default is a custom
 * domain past its allowance keeps creating links instead of hitting an error
 * on flows without a domain picker (quick shorten, bio blocks, QR codes).
 */
export async function getPlanAllowedDefaultDomain(ctx: WorkspaceTRPCContext): Promise<string> {
  return toPlanAllowedDomain(ctx, await getWorkspaceDefaultDomain(ctx));
}

/** `domain` when the plan still allows new links on it, else the platform default. */
export async function toPlanAllowedDomain(
  ctx: WorkspaceTRPCContext,
  domain: string,
): Promise<string> {
  const normalized = domain.trim().toLowerCase();
  if (isPlatformDomain(normalized)) return domain;

  const limit = getPlanCaps(workspaceUsagePlan(ctx.workspace)).domainLimit;
  if (limit === undefined) return domain;

  const scope = workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId);
  const usable = await getUsableCustomDomains(ctx.db, scope, limit);
  return usable.includes(normalized) ? domain : DEFAULT_PLATFORM_DOMAIN;
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
  await assertDomainOwned(ctx, domain);
  await assertDomainWithinPlan(ctx, domain);
}

/** The ownership half of assertDomainAllowed: platform, or verified and in this workspace. */
export async function assertDomainOwned(ctx: WorkspaceTRPCContext, domain: string): Promise<void> {
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

  const limit = getPlanCaps(workspaceUsagePlan(ctx.workspace)).domainLimit;
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

/** On platform domains, app routes like /pricing or /utm-builder shadow the [linkAlias] route. */
export const isAppRouteAlias = (alias: string, domain: string): boolean =>
  isPlatformDomain(domain) && APP_TOP_LEVEL_SEGMENTS.has(alias.toLowerCase());

export const validateAlias = (
  ctx: Pick<ProtectedTRPCContext, "db">,
  alias: string,
  domain: string,
  isPaidUser = false,
  ownLinkId?: number,
): Promise<void> => {
  const aliasRegex = /^[a-zA-Z0-9-_]+$/;

  if (!aliasRegex.test(alias)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Alias can only contain alphanumeric characters, dashes, and underscores",
    });
  }

  if (alias.includes(".")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot include periods in alias" });
  }

  if (isAppRouteAlias(alias, domain)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This alias is reserved. Choose another one.",
    });
  }

  // Free users must have aliases with at least 6 characters
  if (!isPaidUser && alias.length < MINIMUM_ALIAS_LENGTH_FREE) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Custom aliases must be at least ${MINIMUM_ALIAS_LENGTH_FREE} characters on the free plan. Upgrade to Pro for shorter aliases.`,
    });
  }

  return checkAliasAvailability(ctx, alias, domain, ownLinkId);
};

/** `ownLinkId`: the link taking the alias, which may reclaim its own previous addresses. */
export const checkAliasAvailability = async (
  ctx: Pick<ProtectedTRPCContext, "db">,
  alias: string,
  domain: string,
  ownLinkId?: number,
): Promise<void> => {
  const normalizedAlias = normalizeAlias(alias);
  const [aliasExists, reserved] = await Promise.all([
    ctx.db
      .select({ id: link.id })
      .from(link)
      .where(and(sql`lower(${link.alias}) = ${normalizedAlias}`, eq(link.domain, domain)))
      .limit(1),
    isAliasReserved(ctx.db, alias, domain, ownLinkId),
  ]);

  // Same message for a tombstoned alias, so callers can't probe deleted links.
  if (aliasExists.length || reserved) {
    throw new TRPCError({ code: "CONFLICT", message: "Alias already exists" });
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

/** Makes `%`, `_` and `\\` match literally in a MySQL LIKE pattern (default escape char). */
export const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export const MAX_CSV_IMPORT_ROWS = 1000;
export const MAX_CSV_IMPORT_CHARS = 1_000_000;

export type CsvLinkRow = {
  /** Spreadsheet row number: the header is row 1, blank rows still count. */
  row: number;
  url: string;
  alias?: string;
  domain?: string;
  note?: string;
  name?: string;
  /** Set on rows read from a Bitly link export. */
  bitly?: BitlyRow;
};

export type BitlyRow = {
  /** The row's short link as exported: Custom Link when set, else Link. */
  shortLink: string;
  /** `alias` is a custom back-half rather than Bitly's random code. */
  custom: boolean;
  /** Bitly's random code when it differs from the custom back-half on the same domain. */
  code?: string;
  deleted: boolean;
  /** Why the row can't be imported, found while reading it. */
  error?: string;
};

/** Bitly's own short domains; links on them can't move to another service. */
export const BITLY_DOMAINS: ReadonlySet<string> = new Set(["bit.ly", "j.mp", "bitly.is"]);

const MAX_LINK_TEXT_LENGTH = 255;

/** Splits an exported short link like `https://go.example.com/spring-menu` into domain and back-half. */
export const parseShortLink = (value: string): { domain: string; alias: string } | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const alias = url.pathname.replace(/^\/+|\/+$/g, "");
    return alias ? { domain: url.hostname.replace(/\.$/, "").toLowerCase(), alias } : null;
  } catch {
    return null;
  }
};

type CsvRecord = Record<string, string>;

// The current export names the columns Link/Custom Link/Destination URL; exports
// from before 2023 use Bitlink/Custom Bitlink/Long URL.
const readBitlyRecord = (record: CsvRecord, row: number): CsvLinkRow => {
  const link = (record.link ?? record.bitlink ?? "").trim();
  const customLink = (record["custom link"] ?? record["custom bitlink"] ?? "").trim();
  const shortLink = customLink || link;
  const primary = parseShortLink(shortLink);
  const code = customLink ? parseShortLink(link) : null;
  const title = record.title?.trim().slice(0, MAX_LINK_TEXT_LENGTH);

  return {
    row,
    url: (record["destination url"] ?? record["long url"] ?? "").trim(),
    alias: primary?.alias,
    domain: primary?.domain,
    note: `Imported from Bitly: ${link || shortLink}`.slice(0, MAX_LINK_TEXT_LENGTH),
    name: title || undefined,
    bitly: {
      shortLink,
      custom: !!customLink,
      code:
        primary &&
        code &&
        code.domain === primary.domain &&
        normalizeAlias(code.alias) !== normalizeAlias(primary.alias)
          ? code.alias
          : undefined,
      deleted: record.status?.trim().toLowerCase() === "deleted",
      error: primary ? undefined : "This row has no valid Bitly link",
    },
  };
};

const readGenericRecord = (record: CsvRecord, row: number): CsvLinkRow => ({
  row,
  url: record.url?.trim() ?? "",
  alias: record.alias?.trim() || undefined,
  domain: record.domain?.trim() || undefined,
  note: record.note || undefined,
  name: (record.title ?? record.name)?.trim().slice(0, MAX_LINK_TEXT_LENGTH) || undefined,
});

const parsedCsvSchema = z.array(z.record(z.string(), z.string()));

const csvReadError = (error: CsvError) => {
  const line = z.number().int().positive().safeParse(error.lines);
  const where = line.success ? `line ${line.data.toLocaleString("en-US")} of the file` : "the file";
  const quoteProblem =
    error.code === "CSV_INVALID_CLOSING_QUOTE" ||
    error.code === "CSV_QUOTE_NOT_CLOSED" ||
    error.code === "INVALID_OPENING_QUOTE";
  return new TRPCError({
    code: "BAD_REQUEST",
    message: quoteProblem
      ? `Couldn't read ${where}: a quote is not closed or is followed by extra text.`
      : `Couldn't read ${where}. Save the sheet as CSV and try again.`,
  });
};

/**
 * Parses a bulk-import CSV: our own format (a `url` column) or a Bitly link
 * export as downloaded. Headers match case-insensitively and a UTF-8 BOM is
 * ignored, so Excel and Google Sheets exports work as-is. File-level
 * problems throw a user-facing TRPCError; row-level problems are left to the
 * caller so they can be reported per row.
 */
export const parseLinkCsv = (csv: string): CsvLinkRow[] => {
  if (csv.length > MAX_CSV_IMPORT_CHARS) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "This file is larger than 1 MB. Split it into smaller files and import each one.",
    });
  }

  let headers: string[] = [];
  let records: z.infer<typeof parsedCsvSchema>;
  try {
    records = parsedCsvSchema.parse(
      // Blank lines are kept (and dropped below) so row numbers match what a
      // spreadsheet shows; csv-parse's own line counter drifts on quoted CRLFs.
      parse(csv, {
        bom: true,
        columns: (header: string[]) => {
          headers = header.map((name) => name.trim().toLowerCase());
          return headers;
        },
        relax_column_count: true,
      }),
    );
  } catch (error) {
    if (error instanceof CsvError) throw csvReadError(error);
    throw error;
  }

  const readRecord = headers.includes("url")
    ? readGenericRecord
    : isBitlyExport(headers)
      ? readBitlyRecord
      : null;
  if (!readRecord) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        'The first row must be a header with a "url" column, or a link export from Bitly ("Link" and "Destination URL" columns).',
    });
  }

  const rows = records.flatMap((record, index) =>
    Object.values(record).some((value) => value.trim() !== "")
      ? [readRecord(record, index + 2)]
      : [],
  );

  if (rows.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The file has no links to import." });
  }
  if (rows.length > MAX_CSV_IMPORT_ROWS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `This file has ${rows.length.toLocaleString("en-US")} links. Import up to ${MAX_CSV_IMPORT_ROWS.toLocaleString("en-US")} at a time.`,
    });
  }

  return rows;
};

/** Promise.allSettled with at most `limit` tasks in flight; tasks start in input order. */
export const settleWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = Array.from({ length: items.length });
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index]!, index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

/**
 * Links the analytics overview counts: the workspace's short links (no QR codes
 * or bio links), narrowed by the overview filter. The click export uses the
 * same conditions so its rows match the overview.
 */
export const overviewLinkConditions = (
  workspace: WorkspaceTRPCContext["workspace"],
  input: Pick<AllAnalyticsInput, "filterType" | "filterId">,
): SQL[] => {
  const conditions = [
    workspaceFilter(workspace, link.userId, link.teamId),
    eq(link.isQrCode, false),
    eq(link.isBioLink, false),
  ];
  if (input.filterType === "folder" && input.filterId !== undefined) {
    conditions.push(
      input.filterId === "null" ? isNull(link.folderId) : eq(link.folderId, Number(input.filterId)),
    );
  } else if (input.filterType === "domain" && input.filterId) {
    conditions.push(eq(link.domain, String(input.filterId)));
  } else if (input.filterType === "link" && input.filterId) {
    conditions.push(eq(link.id, Number(input.filterId)));
  } else if (input.filterType === "campaign" && input.filterId) {
    conditions.push(eq(link.campaignId, Number(input.filterId)));
  }
  return conditions;
};

export const MAX_CLICK_EXPORT_ROWS = 100_000;

export type ClickExportRow = {
  createdAt: Date | null;
  domain: string;
  alias: string | null;
  url: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  referer: string | null;
};

const CLICK_CSV_HEADER = [
  "Timestamp (UTC)",
  "Short link",
  "Destination",
  "Country",
  "City",
  "Device",
  "Browser",
  "OS",
  "Referrer",
];

// Quote every field, and prefix formula-trigger characters so spreadsheets
// treat user-controlled values (destinations, referrers) as text.
const csvField = (value: string | null) => {
  const text = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

/** `2026-11-23 14:05:09`: ISO in UTC, in the form spreadsheets parse as a date-time. */
const formatUtcTimestamp = (date: Date | null) =>
  date ? date.toISOString().slice(0, 19).replace("T", " ") : "";

export const clicksToCsv = (rows: ClickExportRow[]) => {
  const lines = rows.map((row) =>
    [
      formatUtcTimestamp(row.createdAt),
      `https://${row.domain}/${row.alias ?? ""}`,
      row.url,
      row.country,
      row.city,
      row.device,
      row.browser,
      row.os,
      formatReferrerLabel(row.referer ?? "null"),
    ]
      .map(csvField)
      .join(","),
  );
  return [CLICK_CSV_HEADER.join(","), ...lines].join("\r\n") + "\r\n";
};

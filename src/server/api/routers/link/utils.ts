import { TRPCError } from "@trpc/server";
import { CsvError, parse } from "csv-parse/sync";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getBioLinkBlockLimit } from "@/lib/billing/plans";
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

  const owned = await ctx.db.query.customDomain.findFirst({
    where: and(
      sql`lower(${customDomain.domain}) = ${normalized}`,
      eq(customDomain.status, "active"),
      workspaceFilter(ctx.workspace, customDomain.userId, customDomain.teamId),
    ),
  });

  if (!owned) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Selected domain is not available for this workspace.",
    });
  }
}

const MINIMUM_ALIAS_LENGTH_FREE = 6;

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
};

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
 * Parses a bulk-import CSV. Headers match case-insensitively and a UTF-8 BOM
 * is ignored, so Excel and Google Sheets exports work as-is. File-level
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

  if (!headers.includes("url")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        'The first row must be a header with a "url" column ("alias", "domain" and "note" are optional).',
    });
  }

  const rows = records.flatMap((record, index) =>
    Object.values(record).some((value) => value.trim() !== "")
      ? [
          {
            row: index + 2,
            url: record.url?.trim() ?? "",
            alias: record.alias?.trim() || undefined,
            domain: record.domain?.trim() || undefined,
            note: record.note || undefined,
          },
        ]
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

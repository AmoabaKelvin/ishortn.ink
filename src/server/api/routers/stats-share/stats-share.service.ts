import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";

import { resolveRangeWindow } from "@/lib/core/analytics";
import { getStringFromCache, setStringInCache } from "@/lib/core/cache";
import { absoluteUrl } from "@/lib/utils/absolute-url";
import { runBackgroundTask } from "@/lib/utils/background";
import { flaggedLink, link, team, user } from "@/server/db/schema";
import {
  getTeamAccess,
  getUserEffectivePlan,
  requireFolderAccess,
  workspaceFilter,
} from "@/server/lib/workspace";

import { getLinkVisitsInWindow } from "../link/link.service";
import {
  buildSharedStats,
  canManageStatsShare,
  canViewSharedStats,
  generateStatsShareToken,
  isStatsShareToken,
  resolveSharedStatsRange,
} from "./utils";

import type { PublicTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type {
  GetStatsShareInput,
  ResetStatsShareInput,
  SetStatsShareInput,
} from "./stats-share.input";
import type { SharedStats } from "./utils";

// Shared pages read their counts from KV for up to 5 minutes. Keyed by link, not token, so
// turning sharing off or resetting the link needs no purge: the token is checked in the database
// on every request.
const SHARED_STATS_CACHE_TTL_SECONDS = 5 * 60;
const sharedStatsCacheKey = (linkId: number, range: string) => `sharedstats:v1:${linkId}:${range}`;

type ShareRow = {
  id: number;
  createdByUserId: string | null;
  statsShareToken: string | null;
  statsSharedAt: Date | null;
};

const findLinkForShare = async (ctx: WorkspaceTRPCContext, id: number): Promise<ShareRow> => {
  const found = await ctx.db.query.link.findFirst({
    where: and(eq(link.id, id), workspaceFilter(ctx.workspace, link.userId, link.teamId)),
    columns: {
      id: true,
      folderId: true,
      createdByUserId: true,
      statsShareToken: true,
      statsSharedAt: true,
    },
  });
  if (!found) throw new TRPCError({ code: "NOT_FOUND", message: "Link not found" });
  if (found.folderId) await requireFolderAccess(ctx.db, ctx.workspace, found.folderId);
  return found;
};

const toShareState = (ctx: WorkspaceTRPCContext, row: ShareRow) => ({
  url: row.statsShareToken ? absoluteUrl(`/stats/${row.statsShareToken}`) : null,
  sharedAt: row.statsSharedAt,
  canManage: canManageStatsShare(ctx.workspace, row.createdByUserId),
});

const requireManage = (ctx: WorkspaceTRPCContext, row: ShareRow) => {
  if (!canManageStatsShare(ctx.workspace, row.createdByUserId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only team admins and the link's creator can change sharing",
    });
  }
};

export const getStatsShare = async (ctx: WorkspaceTRPCContext, input: GetStatsShareInput) => {
  return toShareState(ctx, await findLinkForShare(ctx, input.id));
};

export const setStatsShare = async (ctx: WorkspaceTRPCContext, input: SetStatsShareInput) => {
  const found = await findLinkForShare(ctx, input.id);
  requireManage(ctx, found);
  if (input.enabled === !!found.statsShareToken) return toShareState(ctx, found);

  const values = input.enabled
    ? { statsShareToken: generateStatsShareToken(), statsSharedAt: new Date() }
    : { statsShareToken: null, statsSharedAt: null };
  await ctx.db
    .update(link)
    .set(values)
    .where(and(eq(link.id, found.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));
  return toShareState(ctx, { ...found, ...values });
};

/** Issues a new URL; the old one stops working. */
export const resetStatsShare = async (ctx: WorkspaceTRPCContext, input: ResetStatsShareInput) => {
  const found = await findLinkForShare(ctx, input.id);
  requireManage(ctx, found);
  if (!found.statsShareToken) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Sharing is off for this link" });
  }

  const values = { statsShareToken: generateStatsShareToken(), statsSharedAt: new Date() };
  await ctx.db
    .update(link)
    .set(values)
    .where(and(eq(link.id, found.id), workspaceFilter(ctx.workspace, link.userId, link.teamId)));
  return toShareState(ctx, { ...found, ...values });
};

const teamOwner = alias(user, "teamOwner");

/** The link behind a share token, with what decides whether it may be shown. */
const findSharedLink = async (ctx: PublicTRPCContext, token: string) => {
  const [row] = await ctx.db
    .select({
      id: link.id,
      alias: link.alias,
      domain: link.domain,
      name: link.name,
      userId: link.userId,
      teamId: link.teamId,
      statsShareToken: link.statsShareToken,
      disabled: link.disabled,
      blocked: link.blocked,
      flagged: sql<number>`EXISTS (SELECT 1 FROM ${flaggedLink} WHERE ${flaggedLink.linkId} = ${link.id} AND ${flaggedLink.status} = 'pending')`,
      ownerBanned: user.banned,
      ownerRestrictedAt: user.restrictedAt,
      ownerDeletedAt: user.deletedAt,
      teamOwnerId: team.ownerId,
      teamOwnerPlanGraceEndsAt: team.ownerPlanGraceEndsAt,
      teamDeletedAt: team.deletedAt,
      teamOwnerBanned: teamOwner.banned,
      teamOwnerRestrictedAt: teamOwner.restrictedAt,
    })
    .from(link)
    .innerJoin(user, eq(user.id, link.userId))
    .leftJoin(team, eq(team.id, link.teamId))
    .leftJoin(teamOwner, eq(teamOwner.id, team.ownerId))
    .where(eq(link.statsShareToken, token))
    .limit(1);
  return row ? { ...row, flagged: Number(row.flagged) === 1 } : undefined;
};

/**
 * The public, read-only stats behind a share token, or null when there is nothing to show
 * (unknown or revoked token, or a link or account that may not be shown). Holds the owner's plan
 * limits: Free sees the last 7 days only.
 */
export const getSharedStats = async (
  ctx: PublicTRPCContext,
  input: { token: string; range?: string },
) => {
  if (!isStatsShareToken(input.token)) return null;
  const row = await findSharedLink(ctx, input.token);
  if (!row || !canViewSharedStats(row, input.token)) return null;

  const plan =
    row.teamId !== null && row.teamOwnerId
      ? (
          await getTeamAccess(
            { ownerId: row.teamOwnerId, ownerPlanGraceEndsAt: row.teamOwnerPlanGraceEndsAt },
            ctx.db,
          )
        ).plan
      : await getUserEffectivePlan(row.userId, ctx.db);
  const isPaidPlan = plan !== "free";
  const range = resolveSharedStatsRange(input.range, isPaidPlan);

  const cacheKey = sharedStatsCacheKey(row.id, range);
  const cached = await getStringFromCache(cacheKey);
  let stats: SharedStats;
  if (cached) {
    // SAFETY: only this function writes the key, with JSON.stringify of a SharedStats; the key is
    // versioned so a shape change can't read old entries.
    stats = JSON.parse(cached) as SharedStats;
  } else {
    const window = resolveRangeWindow(range, new Date());
    const [visits, uniqueVisits, summaries] = await getLinkVisitsInWindow(
      ctx.db,
      row.id,
      window.from ?? new Date(0),
      window.to,
    );
    stats = buildSharedStats(visits, uniqueVisits, summaries, window);
    // Best effort: a failed cache write only means the next view recomputes.
    void runBackgroundTask(
      setStringInCache(cacheKey, JSON.stringify(stats), SHARED_STATS_CACHE_TTL_SECONDS),
    ).catch(() => undefined);
  }

  return {
    shortLink: `${row.domain}/${row.alias}`,
    title: row.name,
    isPaidPlan,
    range,
    stats,
  };
};

export type SharedStatsPage = NonNullable<Awaited<ReturnType<typeof getSharedStats>>>;

import { nanoid } from "nanoid";

import {
  aggregateVisits,
  fillClickSeries,
  mergeArchivedClicks,
  summarizeArchived,
} from "@/lib/core/analytics";
import { normalizeReferrer } from "@/lib/core/analytics/referrer";
import { isWorkspaceAdmin } from "@/server/lib/workspace/permissions";

import type { RangeWindow } from "@/lib/core/analytics";
import type { WorkspaceContext } from "@/server/lib/workspace/types";

// Pure helpers for shared link analytics (/stats/<token>).

// 24 characters of nanoid's URL-safe alphabet: 144 random bits, never derived from the link.
const TOKEN_LENGTH = 24;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;

export const generateStatsShareToken = () => nanoid(TOKEN_LENGTH);

/** Rejects malformed tokens before they reach the database. */
export const isStatsShareToken = (value: string) => TOKEN_PATTERN.test(value);

/** The presets a shared page offers on a paid plan; the owner page's list without custom ranges. */
export const SHARED_STATS_RANGES = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "all", label: "All time" },
] as const;

export type SharedStatsRange = (typeof SHARED_STATS_RANGES)[number]["value"];

const isSharedStatsRange = (value: string): value is SharedStatsRange =>
  SHARED_STATS_RANGES.some((option) => option.value === value);

/** Free pages always show the last 7 days; paid pages any preset, falling back to 7 days. */
export const resolveSharedStatsRange = (
  requested: string | undefined,
  isPaidPlan: boolean,
): SharedStatsRange =>
  isPaidPlan && requested && isSharedStatsRange(requested) ? requested : "7d";

export const sharedStatsRangeLabel = (range: SharedStatsRange) =>
  SHARED_STATS_RANGES.find((option) => option.value === range)?.label ?? "Last 7 days";

/** What the token lookup reads about a link and the accounts behind it. */
export type SharedStatsLinkRow = {
  statsShareToken: string | null;
  disabled: boolean | null;
  blocked: boolean | null;
  /** A pending abuse report or phishing-rescan match. */
  flagged: boolean;
  ownerBanned: boolean | null;
  ownerRestrictedAt: Date | null;
  ownerDeletedAt: Date | null;
  teamId: number | null;
  /** Null for personal links, and for team links whose team row is gone. */
  teamOwnerId: string | null;
  teamDeletedAt: Date | null;
  teamOwnerBanned: boolean | null;
  teamOwnerRestrictedAt: Date | null;
};

/**
 * Whether a shared stats page may render. The token must match exactly: MySQL's default
 * collation compares case-insensitively, so the lookup alone would accept case variants.
 * A link without a token (including legacy `publicStats` links) is never shared.
 */
export const canViewSharedStats = (row: SharedStatsLinkRow | undefined, token: string) => {
  if (!row?.statsShareToken || row.statsShareToken !== token) return false;
  if (row.disabled || row.blocked || row.flagged) return false;
  if (row.ownerBanned || row.ownerRestrictedAt || row.ownerDeletedAt) return false;
  if (row.teamId !== null) {
    if (!row.teamOwnerId || row.teamDeletedAt) return false;
    if (row.teamOwnerBanned || row.teamOwnerRestrictedAt) return false;
  }
  return true;
};

/** Team admins and the link's creator manage sharing; other members only see its state. */
export const canManageStatsShare = (workspace: WorkspaceContext, createdByUserId: string | null) =>
  workspace.type === "personal" ||
  isWorkspaceAdmin(workspace) ||
  createdByUserId === workspace.userId;

type VisitRow = Parameters<typeof aggregateVisits>[0][number];
type UniqueVisitRow = Parameters<typeof aggregateVisits>[1][number];

/**
 * The aggregate counts a shared page shows. Built from an allowlist so nothing per-visit (cities,
 * device models, verified-visit data, raw referrer URLs, matched targeting rules) leaves the
 * server. Archived clicks count toward the totals and the chart, as on the owner's page.
 */
export const buildSharedStats = (
  visits: VisitRow[],
  uniqueVisits: UniqueVisitRow[],
  summaries: { date: string; clicks: number; uniqueClicks: number }[],
  window: RangeWindow,
) => {
  const aggregated = aggregateVisits(visits, uniqueVisits, window.granularity);
  const archived = summarizeArchived(summaries);
  const referrers: Record<string, number> = {};
  for (const visit of visits) {
    if (!visit.referer) continue;
    const source = normalizeReferrer(visit.referer);
    referrers[source] = (referrers[source] ?? 0) + 1;
  }
  return {
    totalClicks: visits.length + archived.clicks,
    uniqueClicks: uniqueVisits.length + archived.uniqueClicks,
    /** Clicks with per-visit detail; the breakdown lists' percentages are shares of it. */
    detailedClicks: visits.length,
    series: fillClickSeries(mergeArchivedClicks(aggregated, archived), window),
    countries: aggregated.clicksPerCountry,
    devices: aggregated.clicksPerDevice,
    browsers: aggregated.clicksPerBrowser,
    os: aggregated.clicksPerOS,
    referrers,
  };
};

export type SharedStats = ReturnType<typeof buildSharedStats>;

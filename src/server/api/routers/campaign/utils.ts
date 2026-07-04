import { TRPCError } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";
import { endOfYear, startOfMonth, startOfYear, subDays } from "date-fns";

import { getCampaignLimit } from "@/lib/billing/plans";
import { campaign } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";

import type { RangeEnum } from "../link/link.input";
import type { Campaign } from "@/server/db/schema";
import type { WorkspaceTRPCContext } from "../../trpc";

export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
};

// Silent normalization instead of validation errors — casing/spacing
// mistakes are the #1 cause of fragmented UTM data. Shared with the client
// so slug previews match what gets persisted.
export { normalizeCampaignSlug } from "@/lib/campaigns/slug";

/** Normalize a UTM default value: lowercase, trimmed, whitespace to hyphens. */
export function normalizeUtmValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 255);
  return normalized === "" ? null : normalized;
}

/**
 * Merge a campaign's UTM defaults into a link's utmParams. Explicit link
 * values win for source/medium/term/content; campaign defaults only fill
 * gaps. utm_campaign is the exception: it is the campaign's analytics
 * identity and ALWAYS comes from the slug — otherwise a link moved from
 * campaign A to B keeps stamping A's utm_campaign and misattributes B's
 * traffic. Returns undefined when there is nothing to stamp.
 */
export function mergeCampaignUtm(
  campaignRow: Pick<Campaign, "slug" | "utmSource" | "utmMedium" | "utmTerm" | "utmContent">,
  existing?: UtmParams | null,
): UtmParams | undefined {
  const defaults: UtmParams = {};
  if (campaignRow.slug) defaults.utm_campaign = campaignRow.slug;
  if (campaignRow.utmSource) defaults.utm_source = campaignRow.utmSource;
  if (campaignRow.utmMedium) defaults.utm_medium = campaignRow.utmMedium;
  if (campaignRow.utmTerm) defaults.utm_term = campaignRow.utmTerm;
  if (campaignRow.utmContent) defaults.utm_content = campaignRow.utmContent;

  const merged: UtmParams = { ...defaults };
  for (const [key, value] of Object.entries(existing ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      merged[key as keyof UtmParams] = value;
    }
  }
  if (campaignRow.slug) merged.utm_campaign = campaignRow.slug;

  return Object.keys(merged).length > 0 ? merged : undefined;
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

/** Shallow equality over the five UTM keys (empty and absent are the same). */
export function utmParamsEqual(a?: UtmParams | null, b?: UtmParams | null): boolean {
  return UTM_KEYS.every((key) => (a?.[key] ?? "") === (b?.[key] ?? ""));
}

/**
 * Computed display state for a campaign. `status` stays user-set
 * (active/archived); scheduled/ended are derived from the dates for display
 * only — links keep working regardless.
 */
export function getCampaignDisplayState(
  row: Pick<Campaign, "status" | "startDate" | "endDate">,
  now: Date = new Date(),
): "active" | "archived" | "scheduled" | "ended" {
  if (row.status === "archived") return "archived";
  if (row.startDate && row.startDate.getTime() > now.getTime()) return "scheduled";
  if (row.endDate && row.endDate.getTime() < now.getTime()) return "ended";
  return "active";
}

/**
 * Enforce the per-plan ACTIVE campaign cap for the current workspace.
 * Archived campaigns don't count — archiving frees a slot. Runs on create
 * and on unarchive.
 */
export async function checkCampaignLimit(ctx: WorkspaceTRPCContext): Promise<void> {
  const limit = getCampaignLimit(ctx.workspace.plan);
  if (limit === undefined) return; // unlimited (Ultra / team workspaces)

  const [row] = await ctx.db
    .select({ count: count() })
    .from(campaign)
    .where(
      and(
        workspaceFilter(ctx.workspace, campaign.userId, campaign.teamId),
        eq(campaign.status, "active"),
      ),
    );

  const current = Number(row?.count ?? 0);
  if (current >= limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        ctx.workspace.plan === "free"
          ? `You've reached the free plan limit of ${limit} active campaign. Upgrade to Pro for more.`
          : `You've reached your plan's limit of ${limit} active campaigns. Upgrade to Ultra for unlimited campaigns.`,
    });
  }
}

/**
 * Resolve a range enum into a [start, end] window. Mirrors the semantics of
 * getLinkVisits/getAllUserAnalytics (including the last_month/last_year end
 * clamping) without mutating shared Date objects.
 */
export function resolveRangeWindow(range: RangeEnum): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case "24h":
      return { start: subDays(now, 1), end: now };
    case "7d":
      return { start: subDays(now, 7), end: now };
    case "30d":
      return { start: subDays(now, 30), end: now };
    case "90d":
      return { start: subDays(now, 90), end: now };
    case "this_month":
      return { start: startOfMonth(now), end: now };
    case "last_month": {
      const start = startOfMonth(subDays(now, 30));
      const end = new Date(now);
      end.setDate(0); // last day of the previous month
      return { start, end };
    }
    case "this_year":
      return { start: startOfYear(now), end: now };
    case "last_year": {
      const lastYear = subDays(now, 365);
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
    }
    case "all":
      return { start: new Date(0), end: now };
    default:
      return { start: subDays(now, 7), end: now };
  }
}

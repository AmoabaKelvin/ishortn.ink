import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  canUseGeoRules,
  getGeoRulesLimit,
  isUnlimitedGeoRules,
} from "@/lib/billing/plans";
import { deleteGeoRulesFromCache } from "@/lib/core/cache";
import { geoRule, link } from "@/server/db/schema";
import { workspaceFilter } from "@/server/lib/workspace";

import { checkWorkspaceLinkLimit } from "../link/utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type {
  CreateGeoRuleInput,
  DeleteGeoRuleInput,
  GetGeoRulesByLinkInput,
  ReorderGeoRulesInput,
  UpdateGeoRuleInput,
} from "./geo-rules.input";

/**
 * Verify that the link belongs to the current workspace
 */
async function verifyLinkOwnership(
  ctx: WorkspaceTRPCContext,
  linkId: number
) {
  const linkRecord = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, linkId),
      workspaceFilter(ctx.workspace, link.userId, link.teamId)
    ),
  });

  if (!linkRecord) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Link not found or you don't have access to it",
    });
  }

  return linkRecord;
}

/**
 * Check if the user can add more geo rules to a link
 */
async function checkGeoRulesLimit(
  ctx: WorkspaceTRPCContext,
  linkId: number,
  excludeRuleId?: number
) {
  const { plan } = await checkWorkspaceLinkLimit(ctx);

  if (!canUseGeoRules(plan)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Geotargeting is only available on Pro and Ultra plans. Please upgrade to use this feature.",
    });
  }

  // Check current rule count for the link
  const existingRules = await ctx.db.query.geoRule.findMany({
    where: eq(geoRule.linkId, linkId),
  });

  // Exclude the rule being updated from the count
  const currentCount = excludeRuleId
    ? existingRules.filter((r) => r.id !== excludeRuleId).length
    : existingRules.length;

  const limit = getGeoRulesLimit(plan);

  if (!isUnlimitedGeoRules(plan) && limit !== undefined && currentCount >= limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Your plan allows a maximum of ${limit} geo rules per link. Please upgrade to Ultra for unlimited rules.`,
    });
  }

  return { plan, currentCount, limit };
}

/**
 * Get all geo rules for a link
 */
export async function getGeoRulesByLinkId(
  ctx: WorkspaceTRPCContext,
  input: GetGeoRulesByLinkInput
) {
  await verifyLinkOwnership(ctx, input.linkId);

  return ctx.db.query.geoRule.findMany({
    where: eq(geoRule.linkId, input.linkId),
    orderBy: [asc(geoRule.priority)],
  });
}

/**
 * Create a new geo rule for a link
 */
export async function createGeoRule(
  ctx: WorkspaceTRPCContext,
  input: CreateGeoRuleInput
) {
  const linkRecord = await verifyLinkOwnership(ctx, input.linkId);
  await checkGeoRulesLimit(ctx, input.linkId);

  // Get the max priority to add the new rule at the end
  const existingRules = await ctx.db.query.geoRule.findMany({
    where: eq(geoRule.linkId, input.linkId),
    orderBy: [asc(geoRule.priority)],
  });

  const maxPriority = existingRules.length > 0
    ? Math.max(...existingRules.map((r) => r.priority))
    : -1;

  const [result] = await ctx.db.insert(geoRule).values({
    linkId: input.linkId,
    type: input.rule.type,
    condition: input.rule.condition,
    values: input.rule.values,
    action: input.rule.action,
    destination: input.rule.destination,
    blockMessage: input.rule.blockMessage,
    priority: maxPriority + 1,
  });

  // Invalidate cache
  await deleteGeoRulesFromCache(input.linkId);

  return {
    id: Number(result.insertId),
    linkId: input.linkId,
    ...input.rule,
    priority: maxPriority + 1,
  };
}

/**
 * Update an existing geo rule
 */
export async function updateGeoRule(
  ctx: WorkspaceTRPCContext,
  input: UpdateGeoRuleInput
) {
  // First, get the rule to find its linkId
  const existingRule = await ctx.db.query.geoRule.findFirst({
    where: eq(geoRule.id, input.ruleId),
  });

  if (!existingRule) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Geo rule not found",
    });
  }

  // Verify link ownership
  await verifyLinkOwnership(ctx, existingRule.linkId);

  // Update the rule
  await ctx.db
    .update(geoRule)
    .set({
      type: input.rule.type,
      condition: input.rule.condition,
      values: input.rule.values,
      action: input.rule.action,
      destination: input.rule.destination,
      blockMessage: input.rule.blockMessage,
    })
    .where(eq(geoRule.id, input.ruleId));

  // Invalidate cache
  await deleteGeoRulesFromCache(existingRule.linkId);

  return {
    id: input.ruleId,
    linkId: existingRule.linkId,
    ...input.rule,
    priority: existingRule.priority,
  };
}

/**
 * Delete a geo rule
 */
export async function deleteGeoRule(
  ctx: WorkspaceTRPCContext,
  input: DeleteGeoRuleInput
) {
  // First, get the rule to find its linkId
  const existingRule = await ctx.db.query.geoRule.findFirst({
    where: eq(geoRule.id, input.ruleId),
  });

  if (!existingRule) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Geo rule not found",
    });
  }

  // Verify link ownership
  await verifyLinkOwnership(ctx, existingRule.linkId);

  // Delete the rule
  await ctx.db.delete(geoRule).where(eq(geoRule.id, input.ruleId));

  // Invalidate cache
  await deleteGeoRulesFromCache(existingRule.linkId);

  return { success: true };
}

/**
 * Reorder geo rules by updating their priorities
 */
export async function reorderGeoRules(
  ctx: WorkspaceTRPCContext,
  input: ReorderGeoRulesInput
) {
  await verifyLinkOwnership(ctx, input.linkId);

  // Verify all rule IDs belong to this link
  const existingRules = await ctx.db.query.geoRule.findMany({
    where: eq(geoRule.linkId, input.linkId),
  });

  const existingRuleIds = new Set(existingRules.map((r) => r.id));
  const invalidIds = input.ruleIds.filter((id) => !existingRuleIds.has(id));

  if (invalidIds.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Some rule IDs don't belong to this link: ${invalidIds.join(", ")}`,
    });
  }

  // Update priorities based on the order in ruleIds
  await Promise.all(
    input.ruleIds.map((ruleId, index) =>
      ctx.db
        .update(geoRule)
        .set({ priority: index })
        .where(eq(geoRule.id, ruleId))
    )
  );

  // Invalidate cache
  await deleteGeoRulesFromCache(input.linkId);

  return { success: true };
}

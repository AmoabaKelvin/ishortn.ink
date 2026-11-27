import { TRPCError } from "@trpc/server";
import { and, asc, count, eq } from "drizzle-orm";

import { getPlanCaps } from "@/lib/billing/plans";
import { campaign, folder, link, scheduledReport } from "@/server/db/schema";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";
import { scheduledReportTargetExists } from "@/server/lib/scheduled-reports";
import {
  requireFolderAccess,
  requirePermission,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import { reportPeriod } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type {
  CreateScheduledReportInput,
  DeleteScheduledReportInput,
  ListScheduledReportsInput,
  UpdateScheduledReportInput,
} from "./scheduled-report.input";
import type { WorkspacePermission } from "@/server/lib/workspace";

type TargetType = ListScheduledReportsInput["targetType"];

const EDIT_PERMISSION = {
  link: "links.edit",
  folder: "folders.edit",
  campaign: "campaigns.edit",
} satisfies Record<TargetType, WorkspacePermission>;

const NOT_FOUND = {
  link: "Link not found",
  folder: "Folder not found",
  campaign: "Campaign not found",
};

/**
 * Checks the link, folder or campaign is in the workspace and the member can see it (restricted
 * folders included); `write` also needs permission to edit it.
 */
async function requireTarget(
  ctx: WorkspaceTRPCContext,
  input: ListScheduledReportsInput,
  write: boolean,
) {
  if (write) requirePermission(ctx.workspace, EDIT_PERMISSION[input.targetType], "manage reports");

  let folderId: number | null | undefined;
  if (input.targetType === "link") {
    const row = await ctx.db.query.link.findFirst({
      where: and(
        eq(link.id, input.targetId),
        workspaceFilter(ctx.workspace, link.userId, link.teamId),
      ),
      columns: { id: true, folderId: true },
    });
    folderId = row ? row.folderId : undefined;
  } else if (input.targetType === "folder") {
    const row = await ctx.db.query.folder.findFirst({
      where: and(
        eq(folder.id, input.targetId),
        workspaceFilter(ctx.workspace, folder.userId, folder.teamId),
      ),
      columns: { id: true },
    });
    folderId = row?.id;
  } else {
    const row = await ctx.db.query.campaign.findFirst({
      where: and(
        eq(campaign.id, input.targetId),
        workspaceFilter(ctx.workspace, campaign.userId, campaign.teamId),
      ),
      columns: { id: true },
    });
    folderId = row ? null : undefined;
  }

  if (folderId === undefined) {
    throw new TRPCError({ code: "NOT_FOUND", message: NOT_FOUND[input.targetType] });
  }
  if (folderId !== null) await requireFolderAccess(ctx.db, ctx.workspace, folderId);
}

async function getWorkspaceReport(ctx: WorkspaceTRPCContext, id: number) {
  const row = await ctx.db.query.scheduledReport.findFirst({
    where: and(
      eq(scheduledReport.id, id),
      workspaceFilter(ctx.workspace, scheduledReport.userId, scheduledReport.teamId),
    ),
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
  return row;
}

// Schedules whose target was deleted don't count: they can't send and aren't listed anywhere.
const countWorkspaceReports = async (ctx: WorkspaceTRPCContext, db = ctx.db) => {
  const [row] = await db
    .select({ count: count() })
    .from(scheduledReport)
    .where(
      and(
        workspaceFilter(ctx.workspace, scheduledReport.userId, scheduledReport.teamId),
        scheduledReportTargetExists(),
      ),
    );
  return row?.count ?? 0;
};

export const listScheduledReports = async (
  ctx: WorkspaceTRPCContext,
  input: ListScheduledReportsInput,
) => {
  await requireTarget(ctx, input, false);
  const [reports, used] = await Promise.all([
    ctx.db
      .select({
        id: scheduledReport.id,
        frequency: scheduledReport.frequency,
        recipients: scheduledReport.recipients,
        unsubscribed: scheduledReport.unsubscribed,
        lastSentAt: scheduledReport.lastSentAt,
      })
      .from(scheduledReport)
      .where(
        and(
          eq(scheduledReport.targetType, input.targetType),
          eq(scheduledReport.targetId, input.targetId),
          workspaceFilter(ctx.workspace, scheduledReport.userId, scheduledReport.teamId),
        ),
      )
      .orderBy(asc(scheduledReport.id)),
    countWorkspaceReports(ctx),
  ]);

  return {
    reports: reports.map((row) => ({ ...row, unsubscribed: row.unsubscribed ?? [] })),
    plan: ctx.workspace.plan,
    limit: getPlanCaps(ctx.workspace.plan).scheduledReportLimit ?? null,
    used,
  };
};

export const createScheduledReport = async (
  ctx: WorkspaceTRPCContext,
  input: CreateScheduledReportInput,
) => {
  const plan = ctx.workspace.plan;
  const limit = getPlanCaps(plan).scheduledReportLimit;
  if (limit === 0) {
    await recordPlanLimitHit({ userId: ctx.auth.userId, limitKey: "scheduled_reports", plan });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Email reports are available on Pro and Ultra plans. Upgrade to send reports.",
    });
  }
  await requireTarget(ctx, input, true);

  return ctx.db.transaction(async (tx) => {
    if (limit !== undefined && (await countWorkspaceReports(ctx, tx)) >= limit) {
      await recordPlanLimitHit({ userId: ctx.auth.userId, limitKey: "scheduled_reports", plan });
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You've used all ${limit} email reports on your plan. Upgrade to Ultra for unlimited reports.`,
      });
    }

    const [inserted] = await tx
      .insert(scheduledReport)
      .values({
        ...workspaceOwnership(ctx.workspace),
        targetType: input.targetType,
        targetId: input.targetId,
        frequency: input.frequency,
        recipients: input.recipients,
      })
      .$returningId();
    if (!inserted) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create report" });
    }
    return { id: inserted.id };
  });
};

export const updateScheduledReport = async (
  ctx: WorkspaceTRPCContext,
  input: UpdateScheduledReportInput,
) => {
  const existing = await getWorkspaceReport(ctx, input.id);
  await requireTarget(ctx, existing, true);

  await ctx.db
    .update(scheduledReport)
    .set({
      frequency: input.frequency,
      recipients: input.recipients,
      // A new frequency starts with the period in progress, not the one that just ended.
      ...(input.frequency !== existing.frequency && {
        lastPeriodKey: reportPeriod(input.frequency, new Date()).key,
      }),
    })
    .where(eq(scheduledReport.id, existing.id));
  return { id: existing.id };
};

export const deleteScheduledReport = async (
  ctx: WorkspaceTRPCContext,
  input: DeleteScheduledReportInput,
) => {
  const existing = await getWorkspaceReport(ctx, input.id);
  await requireTarget(ctx, existing, true);
  await ctx.db.delete(scheduledReport).where(eq(scheduledReport.id, existing.id));
  return { id: existing.id };
};

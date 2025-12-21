import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { utmTemplate } from "@/server/db/schema";
import {
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import type { WorkspaceTRPCContext } from "../../trpc";
import type {
  CreateUtmTemplateInput,
  UpdateUtmTemplateInput,
} from "./utm-template.input";

const ensureUltraPlan = (ctx: WorkspaceTRPCContext) => {
  // Use workspace plan - team workspaces inherit Ultra features
  if (ctx.workspace.plan !== "ultra") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "UTM templates are only available on the Ultra plan. Please upgrade to use this feature.",
    });
  }
};

export const getUserUtmTemplates = async (ctx: WorkspaceTRPCContext) => {
  return ctx.db.query.utmTemplate.findMany({
    where: workspaceFilter(ctx.workspace, utmTemplate.userId, utmTemplate.teamId),
    orderBy: (template) => template.name,
  });
};

export const getUtmTemplateById = async (
  ctx: WorkspaceTRPCContext,
  id: number
) => {
  return ctx.db.query.utmTemplate.findFirst({
    where: and(eq(utmTemplate.id, id), workspaceFilter(ctx.workspace, utmTemplate.userId, utmTemplate.teamId)),
  });
};

export const createUtmTemplate = async (
  ctx: WorkspaceTRPCContext,
  input: CreateUtmTemplateInput
) => {
  ensureUltraPlan(ctx);

  const ownership = workspaceOwnership(ctx.workspace);

  const [result] = await ctx.db.insert(utmTemplate).values({
    name: input.name,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    utmTerm: input.utmTerm,
    utmContent: input.utmContent,
    userId: ownership.userId,
    teamId: ownership.teamId,
  });

  return {
    id: result.insertId,
    ...input,
    userId: ownership.userId,
    teamId: ownership.teamId,
  };
};

export const updateUtmTemplate = async (
  ctx: WorkspaceTRPCContext,
  input: UpdateUtmTemplateInput
) => {
  ensureUltraPlan(ctx);

  const { id, ...data } = input;

  // Only update if the template belongs to the workspace
  const result = await ctx.db
    .update(utmTemplate)
    .set(data)
    .where(and(eq(utmTemplate.id, id), workspaceFilter(ctx.workspace, utmTemplate.userId, utmTemplate.teamId)));

  if (result[0].affectedRows === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Template not found or access denied",
    });
  }

  const updated = await ctx.db.query.utmTemplate.findFirst({
    where: and(eq(utmTemplate.id, id), workspaceFilter(ctx.workspace, utmTemplate.userId, utmTemplate.teamId)),
  });

  if (!updated) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to retrieve updated template",
    });
  }

  return updated;
};

export const deleteUtmTemplate = async (
  ctx: WorkspaceTRPCContext,
  id: number
) => {
  ensureUltraPlan(ctx);

  // Only delete if the template belongs to the workspace
  const result = await ctx.db
    .delete(utmTemplate)
    .where(and(eq(utmTemplate.id, id), workspaceFilter(ctx.workspace, utmTemplate.userId, utmTemplate.teamId)));

  if (result[0].affectedRows === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Template not found or access denied",
    });
  }

  return { success: true };
};

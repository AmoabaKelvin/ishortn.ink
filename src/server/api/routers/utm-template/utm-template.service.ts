import { and, eq } from "drizzle-orm";

import { utmTemplate } from "@/server/db/schema";

import type { ProtectedTRPCContext } from "../../trpc";
import type {
  CreateUtmTemplateInput,
  UpdateUtmTemplateInput,
} from "./utm-template.input";

export const getUserUtmTemplates = async (ctx: ProtectedTRPCContext) => {
  return ctx.db.query.utmTemplate.findMany({
    where: eq(utmTemplate.userId, ctx.auth.userId),
    orderBy: (template) => template.name,
  });
};

export const getUtmTemplateById = async (
  ctx: ProtectedTRPCContext,
  id: number
) => {
  return ctx.db.query.utmTemplate.findFirst({
    where: and(eq(utmTemplate.id, id), eq(utmTemplate.userId, ctx.auth.userId)),
  });
};

export const createUtmTemplate = async (
  ctx: ProtectedTRPCContext,
  input: CreateUtmTemplateInput
) => {
  const [result] = await ctx.db.insert(utmTemplate).values({
    name: input.name,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    utmTerm: input.utmTerm,
    utmContent: input.utmContent,
    userId: ctx.auth.userId,
  });

  return {
    id: result.insertId,
    ...input,
    userId: ctx.auth.userId,
  };
};

export const updateUtmTemplate = async (
  ctx: ProtectedTRPCContext,
  input: UpdateUtmTemplateInput
) => {
  const { id, ...data } = input;

  // Only update if the template belongs to the user
  await ctx.db
    .update(utmTemplate)
    .set(data)
    .where(and(eq(utmTemplate.id, id), eq(utmTemplate.userId, ctx.auth.userId)));

  return ctx.db.query.utmTemplate.findFirst({
    where: and(eq(utmTemplate.id, id), eq(utmTemplate.userId, ctx.auth.userId)),
  });
};

export const deleteUtmTemplate = async (
  ctx: ProtectedTRPCContext,
  id: number
) => {
  // Only delete if the template belongs to the user
  await ctx.db
    .delete(utmTemplate)
    .where(and(eq(utmTemplate.id, id), eq(utmTemplate.userId, ctx.auth.userId)));
  return { success: true };
};

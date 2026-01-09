import { and, eq, sql } from "drizzle-orm";

import { link, qrcode, qrPreset } from "@/server/db/schema";
import {
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { QRCodeInput, QRPresetCreateInput, QRPresetUpdateInput } from "./qrcode.input";

// Free tier QR code limit
const FREE_QR_CODE_LIMIT = 5;

export const createQrCode = async (ctx: WorkspaceTRPCContext, input: QRCodeInput) => {
  // Use workspace plan - team workspaces have Ultra features (unlimited QR codes)
  const workspacePlan = ctx.workspace.plan;
  const isTeamWorkspace = ctx.workspace.type === "team";

  // Only check limits for free plan personal workspaces
  if (workspacePlan === "free" && !isTeamWorkspace) {
    // Count QR codes in the personal workspace (exclude team QR codes)
    const qrCodeCountResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(qrcode)
      .where(workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId));

    const currentCount = Number(qrCodeCountResult[0]?.count ?? 0);

    if (currentCount >= FREE_QR_CODE_LIMIT) {
      throw new Error(
        "You have reached the maximum number of QR Codes allowed. Please upgrade your subscription to create more QR Codes.",
      );
    }
  }

  let linkId: number | null = null;

  if (input.wasShortened) {
    const popedAlias = input.content.split("/").pop();
    if (!popedAlias) throw new Error("Invalid alias");

    const foundLink = await ctx.db.query.link.findFirst({
      where: and(
        eq(link.alias, popedAlias),
        workspaceFilter(ctx.workspace, link.userId, link.teamId)
      ),
    });

    if (!foundLink) throw new Error("Link not found");

    linkId = foundLink.id;
  }

  const ownership = workspaceOwnership(ctx.workspace);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const insertionResult = await ctx.db.insert(qrcode).values({
    userId: ownership.userId,
    teamId: ownership.teamId,
    title: input.title,
    color: input.selectedColor,
    content: input.content,
    cornerStyle: input.cornerStyle,
    patternStyle: input.patternStyle,
    qrCode: input.qrCodeBase64,
    linkId: linkId ?? 0,
    contentType: input.wasShortened ? "link" : "text",
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } as any);

  const insertedQrCodeId = insertionResult[0].insertId;

  const insertedQrCode = await ctx.db.query.qrcode.findFirst({
    where: (table, { eq }) => eq(table.id, insertedQrCodeId),
  });

  // No longer incrementing personal qrCodeCount - we now count workspace QR codes directly

  return insertedQrCode?.qrCode;
};

export async function retrieveUserQrCodes(ctx: WorkspaceTRPCContext) {
  const qrCodes = await ctx.db.query.qrcode.findMany({
    where: workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId),
    with: {
      link: {
        with: {
          linkVisits: true,
        },
      },
    },
  });

  // biome-ignore lint/complexity/noForEach: <explanation>
  qrCodes.forEach((qrCode) => {
    return { ...qrCode, numberOfVisits: qrCode.link?.linkVisits.length ?? 0 };
  });

  return qrCodes;
}

export async function deleteQrCode(ctx: WorkspaceTRPCContext, id: number) {
  const qrCode = await ctx.db.query.qrcode.findFirst({
    where: and(
      eq(qrcode.id, id),
      workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId)
    ),
  });

  if (!qrCode) throw new Error("QR Code not found");

  await ctx.db.delete(qrcode).where(eq(qrcode.id, id));

  return true;
}

// QR Preset Service Functions
export async function createQrPreset(ctx: WorkspaceTRPCContext, input: QRPresetCreateInput) {
  const ownership = workspaceOwnership(ctx.workspace);

  const insertResult = await ctx.db.insert(qrPreset).values({
    name: input.name,
    userId: ownership.userId ?? "",
    teamId: ownership.teamId,
    pixelStyle: input.pixelStyle,
    markerShape: input.markerShape,
    markerInnerShape: input.markerInnerShape,
    darkColor: input.darkColor,
    lightColor: input.lightColor,
    effect: input.effect,
    effectRadius: input.effectRadius,
    marginNoise: input.marginNoise,
    marginNoiseRate: input.marginNoiseRate,
    // Logo settings
    logoImage: input.logoImage,
    logoSize: input.logoSize,
    logoMargin: input.logoMargin,
    logoBorderRadius: input.logoBorderRadius,
  });

  const insertedId = insertResult[0].insertId;

  return ctx.db.query.qrPreset.findFirst({
    where: eq(qrPreset.id, insertedId),
  });
}

export async function listQrPresets(ctx: WorkspaceTRPCContext) {
  return ctx.db.query.qrPreset.findMany({
    where: workspaceFilter(ctx.workspace, qrPreset.userId, qrPreset.teamId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
}

export async function deleteQrPreset(ctx: WorkspaceTRPCContext, id: number) {
  const preset = await ctx.db.query.qrPreset.findFirst({
    where: and(
      eq(qrPreset.id, id),
      workspaceFilter(ctx.workspace, qrPreset.userId, qrPreset.teamId)
    ),
  });

  if (!preset) throw new Error("Preset not found");

  await ctx.db.delete(qrPreset).where(eq(qrPreset.id, id));

  return true;
}

export async function updateQrPreset(ctx: WorkspaceTRPCContext, input: QRPresetUpdateInput) {
  const preset = await ctx.db.query.qrPreset.findFirst({
    where: and(
      eq(qrPreset.id, input.id),
      workspaceFilter(ctx.workspace, qrPreset.userId, qrPreset.teamId)
    ),
  });

  if (!preset) throw new Error("Preset not found");

  await ctx.db
    .update(qrPreset)
    .set({
      pixelStyle: input.pixelStyle,
      markerShape: input.markerShape,
      markerInnerShape: input.markerInnerShape,
      darkColor: input.darkColor,
      lightColor: input.lightColor,
      effect: input.effect,
      effectRadius: input.effectRadius,
      marginNoise: input.marginNoise,
      marginNoiseRate: input.marginNoiseRate,
      // Logo settings
      logoImage: input.logoImage,
      logoSize: input.logoSize,
      logoMargin: input.logoMargin,
      logoBorderRadius: input.logoBorderRadius,
    })
    .where(eq(qrPreset.id, input.id));

  return ctx.db.query.qrPreset.findFirst({
    where: eq(qrPreset.id, input.id),
  });
}

import { and, eq, sql } from "drizzle-orm";

import { link, qrcode, qrPreset } from "@/server/db/schema";
import { deleteImage, uploadImage } from "@/server/lib/storage";
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

  // Upload QR code image to R2 if it's base64
  if (input.qrCodeBase64) {
    try {
      const imageUrl = await uploadImage(ctx, {
        image: input.qrCodeBase64,
        resourceId: insertedQrCodeId,
        imageType: "qr-code",
      });

      // Update QR code with the R2 URL if upload was successful and URL changed
      if (imageUrl && imageUrl !== input.qrCodeBase64) {
        await ctx.db
          .update(qrcode)
          .set({ qrCode: imageUrl })
          .where(eq(qrcode.id, insertedQrCodeId));

        return imageUrl;
      }
    } catch (error) {
      console.error("Failed to upload QR code image to R2:", error);
      // Don't fail QR code creation if image upload fails - base64 is already saved
    }
  }

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

  // Delete QR code image from R2 if present
  if (qrCode.qrCode) {
    try {
      await deleteImage(qrCode.qrCode);
    } catch (error) {
      console.error("Failed to delete QR code image from R2:", error);
    }
  }

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

  // Upload logo image to R2 if it's base64
  if (input.logoImage) {
    try {
      const imageUrl = await uploadImage(ctx, {
        image: input.logoImage,
        resourceId: insertedId,
        imageType: "qr-logo",
      });

      // Update preset with the R2 URL if upload was successful and URL changed
      if (imageUrl && imageUrl !== input.logoImage) {
        await ctx.db
          .update(qrPreset)
          .set({ logoImage: imageUrl })
          .where(eq(qrPreset.id, insertedId));
      }
    } catch (error) {
      console.error("Failed to upload logo image to R2:", error);
      // Don't fail preset creation if image upload fails - base64 is already saved
    }
  }

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

  // Delete logo image from R2 if present
  if (preset.logoImage) {
    try {
      await deleteImage(preset.logoImage);
    } catch (error) {
      console.error("Failed to delete logo image from R2:", error);
    }
  }

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

  // Handle logo image changes - upload to R2 if base64
  let logoImageUrl = input.logoImage;
  if (input.logoImage) {
    try {
      const imageUrl = await uploadImage(ctx, {
        image: input.logoImage,
        resourceId: input.id,
        imageType: "qr-logo",
      });

      if (imageUrl) {
        logoImageUrl = imageUrl;
      }
    } catch (error) {
      console.error("Failed to upload logo image to R2:", error);
      // Continue with the original image if upload fails
    }
  }

  // Delete old logo from R2 if it's being replaced or removed
  if (preset.logoImage && preset.logoImage !== logoImageUrl) {
    try {
      await deleteImage(preset.logoImage);
    } catch (error) {
      console.error("Failed to delete old logo image from R2:", error);
    }
  }

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
      logoImage: logoImageUrl,
      logoSize: input.logoSize,
      logoMargin: input.logoMargin,
      logoBorderRadius: input.logoBorderRadius,
    })
    .where(eq(qrPreset.id, input.id));

  return ctx.db.query.qrPreset.findFirst({
    where: eq(qrPreset.id, input.id),
  });
}

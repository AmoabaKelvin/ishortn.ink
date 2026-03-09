import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, sql } from "drizzle-orm";

import { deleteFromCache } from "@/lib/core/cache";
import { generateShortLink } from "@/lib/core/links";
import { fetchMetadataInfo } from "@/lib/utils/fetch-link-metadata";
import { detectPhishingLink } from "@/server/api/routers/ai/ai.service";
import { USER_MSG_UNSAFE } from "@/server/lib/phishing";
import { link, linkVisit, qrcode, qrPreset, uniqueLinkVisit } from "@/server/db/schema";
import { deleteImage, uploadImage } from "@/server/lib/storage";
import {
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";
import {
  checkWorkspaceLinkLimit,
  incrementWorkspaceLinkCount,
} from "../link/utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { QRCodeInput, QRPresetCreateInput, QRPresetUpdateInput } from "./qrcode.input";
import type { z } from "zod";
import type { qrcodeSaveImageInput } from "./qrcode.input";

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

  const ownership = workspaceOwnership(ctx.workspace);

  let linkLimitResult: Awaited<ReturnType<typeof checkWorkspaceLinkLimit>>;
  try {
    linkLimitResult = await checkWorkspaceLinkLimit(ctx);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "You've reached your monthly link limit. Each QR code requires a tracking link, which counts toward your plan's link quota. Please upgrade your plan to create more QR codes.",
      });
    }
    throw error;
  }
  const { currentCount, limit } = linkLimitResult;

  const fetchedMetadata = await fetchMetadataInfo(input.content);
  const phishingResult = await detectPhishingLink(input.content, fetchedMetadata);

  if (phishingResult.phishing) {
    throw new Error(USER_MSG_UNSAFE);
  }

  const alias = await generateShortLink();
  const trackingUrl = `https://ishortn.ink/${alias}`;

  const { insertedQrCodeId } = await ctx.db.transaction(async (tx) => {
    const hiddenLinkResult = await tx.insert(link).values({
      url: input.content,
      alias,
      domain: "ishortn.ink",
      name: input.title || "QR Code",
      isQrCode: true,
      userId: ownership.userId ?? ctx.auth.userId,
      teamId: ownership.teamId,
      createdByUserId: ctx.auth.userId,
    });

    const hiddenLinkId = hiddenLinkResult[0].insertId;

    const insertionResult = await tx.insert(qrcode).values({
      userId: ownership.userId,
      teamId: ownership.teamId,
      title: input.title,
      color: input.selectedColor,
      content: input.content,
      cornerStyle: input.cornerStyle as typeof qrcode.cornerStyle.enumValues[number],
      patternStyle: input.patternStyle as typeof qrcode.patternStyle.enumValues[number],
      linkId: hiddenLinkId,
      contentType: "link",
    });

    return { insertedQrCodeId: insertionResult[0].insertId };
  });

  await incrementWorkspaceLinkCount(ctx, currentCount, limit);

  return { trackingUrl, id: insertedQrCodeId };
};

export const saveQrCodeImage = async (
  ctx: WorkspaceTRPCContext,
  input: z.infer<typeof qrcodeSaveImageInput>,
) => {
  const record = await ctx.db.query.qrcode.findFirst({
    where: and(
      eq(qrcode.id, input.id),
      workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId),
    ),
  });

  if (!record) throw new Error("QR Code not found");

  // Persist base64 immediately so we have a fallback
  await ctx.db
    .update(qrcode)
    .set({ qrCode: input.qrCodeBase64 })
    .where(eq(qrcode.id, input.id));

  // Upload to R2
  try {
    const imageUrl = await uploadImage(ctx, {
      image: input.qrCodeBase64,
      resourceId: input.id,
      imageType: "qr-code",
    });

    if (imageUrl && imageUrl !== input.qrCodeBase64) {
      await ctx.db
        .update(qrcode)
        .set({ qrCode: imageUrl })
        .where(eq(qrcode.id, input.id));

      return imageUrl;
    }
  } catch (error) {
    console.error("Failed to upload QR code image to R2:", error);
  }

  return input.qrCodeBase64;
};

export async function getQrCode(ctx: WorkspaceTRPCContext, id: number) {
  const qrCode = await ctx.db.query.qrcode.findFirst({
    where: and(
      eq(qrcode.id, id),
      workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId)
    ),
    with: {
      link: true,
    },
  });

  if (!qrCode) throw new Error("QR Code not found");

  return qrCode;
}

export async function retrieveUserQrCodes(ctx: WorkspaceTRPCContext) {
  const qrCodes = await ctx.db.query.qrcode.findMany({
    where: workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId),
    with: {
      link: true,
    },
  });

  // Get visit counts in a single aggregation query instead of loading all visit rows
  const linkIds = qrCodes.map((qr) => qr.linkId).filter((id): id is number => id != null && id > 0);
  const visitCounts =
    linkIds.length > 0
      ? await ctx.db
          .select({ linkId: linkVisit.linkId, count: count() })
          .from(linkVisit)
          .where(inArray(linkVisit.linkId, linkIds))
          .groupBy(linkVisit.linkId)
      : [];

  const countMap = new Map(visitCounts.map((v) => [v.linkId, v.count]));

  return qrCodes.map((qr) => ({
    ...qr,
    visitCount: countMap.get(qr.linkId!) ?? 0,
  }));
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

  // Collect cache key before the transaction so we can invalidate after it commits
  let cacheKey: string | undefined;
  if (qrCode.linkId && qrCode.linkId > 0) {
    const hiddenLink = await ctx.db.query.link.findFirst({
      where: eq(link.id, qrCode.linkId),
    });
    if (hiddenLink?.alias) {
      cacheKey = `${hiddenLink.domain}:${hiddenLink.alias}`;
    }
  }

  // Delete QR code and its associated hidden link atomically
  await ctx.db.transaction(async (tx) => {
    await tx.delete(qrcode).where(eq(qrcode.id, id));

    if (qrCode.linkId && qrCode.linkId > 0) {
      await Promise.all([
        tx.delete(uniqueLinkVisit).where(eq(uniqueLinkVisit.linkId, qrCode.linkId)),
        tx.delete(linkVisit).where(eq(linkVisit.linkId, qrCode.linkId)),
      ]);
      await tx.delete(link).where(eq(link.id, qrCode.linkId));
    }
  });

  // Invalidate cache after the transaction commits successfully
  if (cacheKey) {
    void deleteFromCache(cacheKey);
  }

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

  // Handle logo image changes:
  // - undefined: not provided, preserve existing preset.logoImage
  // - null: explicit removal, delete from R2 and set to null
  // - string: replacement, upload new and delete old
  let logoImageUrl: string | null | undefined;

  if (input.logoImage === undefined) {
    // Not provided - preserve existing
    logoImageUrl = preset.logoImage;
  } else if (input.logoImage === null) {
    // Explicit removal - delete old image if exists
    logoImageUrl = null;
    if (preset.logoImage) {
      try {
        await deleteImage(preset.logoImage);
      } catch (error) {
        console.error("Failed to delete logo image from R2:", error);
      }
    }
  } else {
    // New image provided - upload to R2
    try {
      const imageUrl = await uploadImage(ctx, {
        image: input.logoImage,
        resourceId: input.id,
        imageType: "qr-logo",
      });

      logoImageUrl = imageUrl ?? input.logoImage;

      // Delete old logo from R2 if it's being replaced
      if (preset.logoImage && preset.logoImage !== logoImageUrl) {
        try {
          await deleteImage(preset.logoImage);
        } catch (error) {
          console.error("Failed to delete old logo image from R2:", error);
        }
      }
    } catch (error) {
      console.error("Failed to upload logo image to R2:", error);
      // Continue with the input image if upload fails
      logoImageUrl = input.logoImage;
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

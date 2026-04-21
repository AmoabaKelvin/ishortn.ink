import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, sql } from "drizzle-orm";

import { buildCacheKey, deleteFromCache } from "@/lib/core/cache";
import { generateShortLink } from "@/lib/core/links";
import { logger } from "@/lib/logger";
import { runBackgroundTask } from "@/lib/utils/background";
import { assertUrlSafe } from "@/server/lib/phishing";
import { link, linkVisit, qrcode, qrPreset, uniqueLinkVisit, user } from "@/server/db/schema";
import { deleteImage, uploadImage } from "@/server/lib/storage";
import {
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";
import {
  checkWorkspaceLinkLimit,
  getWorkspaceDefaultDomain,
} from "../link/utils";

import { updateLink } from "../link/link.service";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { QRCodeInput, QRCodeUpdateInput, QRPresetCreateInput, QRPresetUpdateInput } from "./qrcode.input";
import type { z } from "zod";
import type { qrcodeSaveImageInput } from "./qrcode.input";

const log = logger.child({ component: "qrcode.service" });

// Free tier QR code limit
const FREE_QR_CODE_LIMIT = 5;

function userFacing<A extends unknown[], R>(
  operation: string,
  fallbackMessage: string,
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      log.error({ err: error, operation }, "unexpected error in qrcode service");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: fallbackMessage,
      });
    }
  };
}

export const createQrCode = userFacing(
  "createQrCode",
  "Something went wrong while creating your QR code. Please try again.",
  async (ctx: WorkspaceTRPCContext, input: QRCodeInput) => {
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
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You've reached the free plan limit of ${FREE_QR_CODE_LIMIT} QR codes. Upgrade to Pro to create more.`,
        });
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

    await assertUrlSafe(input.content);

    const [alias, domain] = await Promise.all([
      generateShortLink(),
      getWorkspaceDefaultDomain(ctx),
    ]);
    const trackingUrl = `https://${domain}/${alias}`;

    // Personal workspaces with a plan-defined quota have their monthly
    // link count bumped inside the same transaction, so a count-update
    // failure rolls the QR and hidden link back together — no orphan rows.
    const shouldIncrementCount =
      ctx.workspace.type !== "team" && limit !== undefined;

    const { insertedQrCodeId } = await ctx.db.transaction(async (tx) => {
      const hiddenLinkResult = await tx.insert(link).values({
        url: input.content,
        alias,
        domain,
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

      if (shouldIncrementCount) {
        await tx
          .update(user)
          .set({ monthlyLinkCount: currentCount + 1 })
          .where(eq(user.id, ctx.auth.userId));
      }

      return { insertedQrCodeId: insertionResult[0].insertId };
    });

    return { trackingUrl, id: insertedQrCodeId };
  },
);

export const saveQrCodeImage = userFacing(
  "saveQrCodeImage",
  "Something went wrong while saving your QR code image. Please try again.",
  async (
    ctx: WorkspaceTRPCContext,
    input: z.infer<typeof qrcodeSaveImageInput>,
  ) => {
    const record = await ctx.db.query.qrcode.findFirst({
      where: and(
        eq(qrcode.id, input.id),
        workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId),
      ),
    });

    if (!record) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "QR code not found.",
      });
    }

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
      log.error({ err: error, qrCodeId: input.id }, "failed to upload QR code image to R2");
    }

    return input.qrCodeBase64;
  },
);

export const getQrCode = userFacing(
  "getQrCode",
  "Something went wrong while loading this QR code. Please try again.",
  async (ctx: WorkspaceTRPCContext, id: number) => {
    const qrCode = await ctx.db.query.qrcode.findFirst({
      where: and(
        eq(qrcode.id, id),
        workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId),
      ),
      with: {
        link: true,
      },
    });

    if (!qrCode) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "QR code not found.",
      });
    }

    return qrCode;
  },
);

export const retrieveUserQrCodes = userFacing(
  "retrieveUserQrCodes",
  "Something went wrong while loading your QR codes. Please try again.",
  async (ctx: WorkspaceTRPCContext) => {
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
  },
);

export const deleteQrCode = userFacing(
  "deleteQrCode",
  "Something went wrong while deleting your QR code. Please try again.",
  async (ctx: WorkspaceTRPCContext, id: number) => {
    const qrCode = await ctx.db.query.qrcode.findFirst({
      where: and(
        eq(qrcode.id, id),
        workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId),
      ),
      with: { link: true },
    });

    if (!qrCode) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "QR code not found.",
      });
    }

    // Delete QR code image from R2 if present
    if (qrCode.qrCode) {
      try {
        await deleteImage(qrCode.qrCode);
      } catch (error) {
        log.error({ err: error, qrCodeId: id }, "failed to delete QR code image from R2");
      }
    }

    // Collect cache key before the transaction so we can invalidate after it commits
    let cacheKey: string | undefined;
    if (qrCode.link?.alias) {
      cacheKey = buildCacheKey(qrCode.link.domain, qrCode.link.alias);
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
      void runBackgroundTask(deleteFromCache(cacheKey));
    }

    return true;
  },
);

// ---------------------------------------------------------------------------
// QR Code Update / Actions
// ---------------------------------------------------------------------------

/** Fetch a QR code by ID with workspace ownership check, joining the associated link. */
async function fetchQrCodeWithLink(ctx: WorkspaceTRPCContext, id: number) {
  const qrCode = await ctx.db.query.qrcode.findFirst({
    where: and(
      eq(qrcode.id, id),
      workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId),
    ),
    with: { link: true },
  });

  if (!qrCode) {
    throw new TRPCError({ code: "NOT_FOUND", message: "QR code not found." });
  }
  if (!qrCode.linkId || !qrCode.link) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This QR code has no associated link.",
    });
  }

  return qrCode as typeof qrCode & { linkId: number; link: NonNullable<typeof qrCode.link> };
}

export const updateQrCode = userFacing(
  "updateQrCode",
  "Something went wrong while updating your QR code. Please try again.",
  async (ctx: WorkspaceTRPCContext, input: QRCodeUpdateInput) => {
    const qrCode = await fetchQrCodeWithLink(ctx, input.id);

    // Phishing check on new destination URL
    if (input.url) {
      await assertUrlSafe(input.url);
    }

    const qrUpdates: Partial<Pick<typeof qrcode.$inferInsert, "title" | "content">> = {};
    if (input.title !== undefined) qrUpdates.title = input.title;
    if (input.url !== undefined) qrUpdates.content = input.url;

    // Apply the link update first so a failure there leaves both the live
    // redirect target and the QR metadata at their prior values. assertUrlSafe
    // has already validated the new URL, so there's no safety window to close.
    const { id: _qrId, title, url, ...linkFields } = input;
    await updateLink(ctx, {
      id: qrCode.linkId,
      url,
      name: title,
      ...linkFields,
    });

    if (Object.keys(qrUpdates).length > 0) {
      await ctx.db
        .update(qrcode)
        .set(qrUpdates)
        .where(eq(qrcode.id, input.id));
    }

    return true;
  },
);

export const resetQrCodeStatistics = userFacing(
  "resetQrCodeStatistics",
  "Something went wrong while resetting statistics. Please try again.",
  async (ctx: WorkspaceTRPCContext, id: number) => {
    const qrCode = await fetchQrCodeWithLink(ctx, id);

    // Delete both visit tables to fully reset stats (matches deleteQrCode cleanup)
    await Promise.all([
      ctx.db.delete(linkVisit).where(eq(linkVisit.linkId, qrCode.linkId)),
      ctx.db.delete(uniqueLinkVisit).where(eq(uniqueLinkVisit.linkId, qrCode.linkId)),
    ]);

    return true;
  },
);

export const toggleQrCodeStatus = userFacing(
  "toggleQrCodeStatus",
  "Something went wrong while toggling QR code status. Please try again.",
  async (ctx: WorkspaceTRPCContext, id: number) => {
    const qrCode = await fetchQrCodeWithLink(ctx, id);

    // Inline instead of delegating to toggleLinkStatusService to avoid a redundant link re-fetch
    await ctx.db
      .update(link)
      .set({ disabled: !qrCode.link.disabled })
      .where(eq(link.id, qrCode.linkId));

    // Invalidate cache so the status change takes effect immediately
    if (qrCode.link.alias) {
      await deleteFromCache(buildCacheKey(qrCode.link.domain, qrCode.link.alias));
    }

    return true;
  },
);

// QR Preset Service Functions
export const createQrPreset = userFacing(
  "createQrPreset",
  "Something went wrong while creating your preset. Please try again.",
  async (ctx: WorkspaceTRPCContext, input: QRPresetCreateInput) => {
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
        log.error(
          { err: error, presetId: insertedId, action: "create" },
          "failed to upload logo image to R2",
        );
        // Don't fail preset creation if image upload fails - base64 is already saved
      }
    }

    return ctx.db.query.qrPreset.findFirst({
      where: eq(qrPreset.id, insertedId),
    });
  },
);

export const listQrPresets = userFacing(
  "listQrPresets",
  "Something went wrong while loading your presets. Please try again.",
  async (ctx: WorkspaceTRPCContext) => {
    return ctx.db.query.qrPreset.findMany({
      where: workspaceFilter(ctx.workspace, qrPreset.userId, qrPreset.teamId),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
  },
);

export const deleteQrPreset = userFacing(
  "deleteQrPreset",
  "Something went wrong while deleting your preset. Please try again.",
  async (ctx: WorkspaceTRPCContext, id: number) => {
    const preset = await ctx.db.query.qrPreset.findFirst({
      where: and(
        eq(qrPreset.id, id),
        workspaceFilter(ctx.workspace, qrPreset.userId, qrPreset.teamId),
      ),
    });

    if (!preset) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "QR preset not found.",
      });
    }

    // Delete logo image from R2 if present
    if (preset.logoImage) {
      try {
        await deleteImage(preset.logoImage);
      } catch (error) {
        log.error(
          { err: error, presetId: id, action: "delete-preset" },
          "failed to delete logo image from R2",
        );
      }
    }

    await ctx.db.delete(qrPreset).where(eq(qrPreset.id, id));

    return true;
  },
);

export const updateQrPreset = userFacing(
  "updateQrPreset",
  "Something went wrong while updating your preset. Please try again.",
  async (ctx: WorkspaceTRPCContext, input: QRPresetUpdateInput) => {
    const preset = await ctx.db.query.qrPreset.findFirst({
      where: and(
        eq(qrPreset.id, input.id),
        workspaceFilter(ctx.workspace, qrPreset.userId, qrPreset.teamId),
      ),
    });

    if (!preset) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "QR preset not found.",
      });
    }

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
          log.error(
            { err: error, presetId: input.id, action: "remove-logo" },
            "failed to delete logo image from R2",
          );
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
            log.error(
              { err: error, presetId: input.id, action: "replace-logo" },
              "failed to delete old logo image from R2",
            );
          }
        }
      } catch (error) {
        log.error(
          { err: error, presetId: input.id, action: "update-preset" },
          "failed to upload logo image to R2",
        );
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
  },
);

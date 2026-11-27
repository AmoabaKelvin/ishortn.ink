import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, sum } from "drizzle-orm";

import { getPlanCaps } from "@/lib/billing/plans";
import { buildCacheKey, deleteFromCache } from "@/lib/core/cache";
import { logger } from "@/lib/logger";
import { encodeStaticQrPayload } from "@/lib/qr-generator/payload";
import { runBackgroundTask } from "@/lib/utils/background";
import {
  link,
  linkVisit,
  linkVisitDailySummary,
  qrcode,
  qrPreset,
  uniqueLinkVisit,
} from "@/server/db/schema";
import { recordSafetyFollowUp } from "@/server/lib/phishing/follow-up";
import { checkCampaignPatternsAfterResponse } from "@/server/lib/phishing/rescan";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";
import { reserveLinkAliases } from "@/server/lib/reserved-alias";
import { assertValidImageInput, deleteImage, uploadImage } from "@/server/lib/storage";
import { insertHiddenTrackingLink, prepareHiddenTrackingLink } from "@/server/lib/tracking-link";
import {
  getAccessibleFolderIds,
  requireFolderAccess,
  workspaceFilter,
  workspaceOwnership,
} from "@/server/lib/workspace";

import { updateLink } from "../link/link.service";
import { countWorkspaceQrCodes, deleteQrCodeImages } from "./qrcode-bulk.service";
import { toLegacyQrStyles } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type {
  QRCodeInput,
  QRCodeStaticInput,
  QRCodeStaticUpdateInput,
  QRCodeUpdateInput,
  QRPresetCreateInput,
  QRPresetUpdateInput,
} from "./qrcode.input";
import type { qrcodeSaveImageInput } from "./qrcode.input";
import type { StaticQrPayload } from "@/lib/qr-generator/payload";
import type { z } from "zod";

const log = logger.child({ component: "qrcode.service" });

// A code's own hidden tracking link never sits in a folder, but a code made by a CSV import encodes
// one of the workspace's visible links, which can. Those follow the link's folder access.
async function requireQrCodeLinkAccess(
  ctx: WorkspaceTRPCContext,
  qrLink: { isQrCode: boolean | null; folderId: number | null } | null | undefined,
) {
  if (qrLink && !qrLink.isQrCode && qrLink.folderId) {
    await requireFolderAccess(ctx.db, ctx.workspace, qrLink.folderId);
  }
}

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

async function assertQrCodeCapacity(ctx: WorkspaceTRPCContext) {
  // Team workspaces have Ultra features (unlimited QR codes); limits apply to personal ones.
  const qrCodeLimit =
    ctx.workspace.type === "team" ? undefined : getPlanCaps(ctx.workspace.plan).qrCodeLimit;
  if (qrCodeLimit === undefined) return;

  const currentCount = await countWorkspaceQrCodes(ctx);
  if (currentCount >= qrCodeLimit) {
    await recordPlanLimitHit({
      userId: ctx.auth.userId,
      limitKey: "qr_codes",
      plan: ctx.workspace.plan,
    });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached your plan's limit of ${qrCodeLimit} QR codes. Upgrade to create more.`,
    });
  }
}

/** Columns for a static code's content; plain text keeps no form fields. */
function staticContentColumns(payload: StaticQrPayload) {
  const isForm = payload.type !== "text";
  return {
    contentType: "text" as const,
    content: encodeStaticQrPayload(payload),
    payloadType: isForm ? payload.type : null,
    payloadFields: isForm ? payload : null,
  };
}

export const createQrCode = userFacing(
  "createQrCode",
  "Something went wrong while creating your QR code. Please try again.",
  async (ctx: WorkspaceTRPCContext, input: QRCodeInput) => {
    await assertQrCodeCapacity(ctx);

    const ownership = workspaceOwnership(ctx.workspace);

    // Prepare the hidden tracking link (quota check + URL safety + domain +
    // alias). Re-message the link-limit error for the QR context.
    let prepared: Awaited<ReturnType<typeof prepareHiddenTrackingLink>>;
    try {
      prepared = await prepareHiddenTrackingLink(ctx, {
        url: input.content,
        name: input.title || "QR Code",
        domain: input.domain?.trim() || undefined,
        kind: "qr",
      });
    } catch (error) {
      if (error instanceof TRPCError && error.code === "FORBIDDEN" && /link/i.test(error.message)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "You've reached your monthly link limit. Each QR code requires a tracking link, which counts toward your plan's link quota. Please upgrade your plan to create more QR codes.",
        });
      }
      throw error;
    }

    const { insertedQrCodeId, hiddenLinkId } = await ctx.db.transaction(async (tx) => {
      const hiddenLinkId = await insertHiddenTrackingLink(tx, ctx, prepared);

      const insertionResult = await tx.insert(qrcode).values({
        userId: ownership.userId,
        teamId: ownership.teamId,
        title: input.title,
        color: input.selectedColor,
        content: input.content,
        ...toLegacyQrStyles(input.patternStyle, input.cornerStyle),
        linkId: hiddenLinkId,
        contentType: "link",
      });

      return { insertedQrCodeId: insertionResult[0].insertId, hiddenLinkId };
    });
    recordSafetyFollowUp(hiddenLinkId, prepared.safety);
    checkCampaignPatternsAfterResponse([{ linkId: hiddenLinkId, url: input.content }]);

    return { trackingUrl: prepared.trackingUrl, id: insertedQrCodeId };
  },
);

// Static codes encode their content directly: no tracking link, so they use no link quota and
// can't be tracked. They count toward the QR code limit like any other code.
export const createStaticQrCode = userFacing(
  "createStaticQrCode",
  "Something went wrong while creating your QR code. Please try again.",
  async (ctx: WorkspaceTRPCContext, input: QRCodeStaticInput) => {
    await assertQrCodeCapacity(ctx);

    const ownership = workspaceOwnership(ctx.workspace);
    const columns = staticContentColumns(input.payload);
    const [result] = await ctx.db.insert(qrcode).values({
      userId: ownership.userId,
      teamId: ownership.teamId,
      title: input.title,
      color: input.selectedColor,
      ...toLegacyQrStyles(input.patternStyle, input.cornerStyle),
      linkId: 0,
      ...columns,
    });

    return { id: result.insertId, content: columns.content };
  },
);

export const updateStaticQrCode = userFacing(
  "updateStaticQrCode",
  "Something went wrong while updating your QR code. Please try again.",
  async (ctx: WorkspaceTRPCContext, input: QRCodeStaticUpdateInput) => {
    const record = await ctx.db.query.qrcode.findFirst({
      where: and(
        eq(qrcode.id, input.id),
        workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId),
      ),
      columns: { id: true, contentType: true, linkId: true },
    });
    if (!record) {
      throw new TRPCError({ code: "NOT_FOUND", message: "QR code not found." });
    }
    if (record.contentType !== "text" || (record.linkId ?? 0) > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only static QR codes can be edited this way.",
      });
    }
    assertValidImageInput(input.qrCodeBase64);

    await ctx.db
      .update(qrcode)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...staticContentColumns(input.payload),
      })
      .where(eq(qrcode.id, input.id));

    return saveQrCodeImage(ctx, { id: input.id, qrCodeBase64: input.qrCodeBase64 });
  },
);

export const saveQrCodeImage = userFacing(
  "saveQrCodeImage",
  "Something went wrong while saving your QR code image. Please try again.",
  async (ctx: WorkspaceTRPCContext, input: z.infer<typeof qrcodeSaveImageInput>) => {
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

    assertValidImageInput(input.qrCodeBase64);
    const logo = input.style?.logoImage;
    if (logo) assertValidImageInput(logo);

    // Persist base64 immediately so we have a fallback. The style only ever holds an uploaded logo
    // URL: the list returns every row's style, and a data URI would add up to 2.7MB per code. If
    // the logo upload fails, the code's SVG is drawn without it.
    await ctx.db
      .update(qrcode)
      .set({
        qrCode: input.qrCodeBase64,
        ...(input.style && { style: { ...input.style, logoImage: null } }),
      })
      .where(eq(qrcode.id, input.id));

    // Upload to R2. The logo is kept so the SVG download can embed it.
    try {
      const [imageUrl, logoUrl] = await Promise.all([
        uploadImage(ctx, { image: input.qrCodeBase64, resourceId: input.id, imageType: "qr-code" }),
        logo
          ? uploadImage(ctx, { image: logo, resourceId: input.id, imageType: "qr-code-logo" })
          : undefined,
      ]);
      const uploadedImage = imageUrl && imageUrl !== input.qrCodeBase64 ? imageUrl : undefined;
      const uploadedLogo = logoUrl && logoUrl !== logo ? logoUrl : undefined;

      if (uploadedImage || (input.style && uploadedLogo)) {
        await ctx.db
          .update(qrcode)
          .set({
            ...(uploadedImage && { qrCode: uploadedImage }),
            ...(input.style &&
              uploadedLogo && { style: { ...input.style, logoImage: uploadedLogo } }),
          })
          .where(eq(qrcode.id, input.id));
      }
      if (uploadedImage) return uploadedImage;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
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
      where: and(eq(qrcode.id, id), workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId)),
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
    await requireQrCodeLinkAccess(ctx, qrCode.link);

    return qrCode;
  },
);

export const retrieveUserQrCodes = userFacing(
  "retrieveUserQrCodes",
  "Something went wrong while loading your QR codes. Please try again.",
  async (ctx: WorkspaceTRPCContext) => {
    const allQrCodes = await ctx.db.query.qrcode.findMany({
      where: workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId),
      with: {
        link: true,
      },
    });

    const folderIds = [
      ...new Set(
        allQrCodes
          .map((qr) => (qr.link && !qr.link.isQrCode ? qr.link.folderId : null))
          .filter((id): id is number => id != null),
      ),
    ];
    const accessibleFolderIds = new Set(
      await getAccessibleFolderIds(ctx.db, ctx.workspace, folderIds),
    );
    const qrCodes = allQrCodes.filter(
      (qr) =>
        !qr.link ||
        qr.link.isQrCode ||
        !qr.link.folderId ||
        accessibleFolderIds.has(qr.link.folderId),
    );

    // Get visit counts in a single aggregation query instead of loading all visit rows.
    // Combine raw visits with archived clicks rolled up by the analytics cleanup job.
    const linkIds = qrCodes
      .map((qr) => qr.linkId)
      .filter((id): id is number => id != null && id > 0);
    const [visitCounts, archivedCounts] =
      linkIds.length > 0
        ? await Promise.all([
            ctx.db
              .select({ linkId: linkVisit.linkId, count: count() })
              .from(linkVisit)
              .where(inArray(linkVisit.linkId, linkIds))
              .groupBy(linkVisit.linkId),
            ctx.db
              .select({
                linkId: linkVisitDailySummary.linkId,
                total: sum(linkVisitDailySummary.clicks),
              })
              .from(linkVisitDailySummary)
              .where(inArray(linkVisitDailySummary.linkId, linkIds))
              .groupBy(linkVisitDailySummary.linkId),
          ])
        : [[], []];

    const countMap = new Map(visitCounts.map((v) => [v.linkId, v.count]));
    for (const row of archivedCounts) {
      countMap.set(row.linkId, (countMap.get(row.linkId) ?? 0) + (Number(row.total) || 0));
    }

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
      where: and(eq(qrcode.id, id), workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId)),
      with: { link: true },
    });

    if (!qrCode) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "QR code not found.",
      });
    }

    await requireQrCodeLinkAccess(ctx, qrCode.link);

    // Only a code's own hidden tracking link goes with it. Codes made by a CSV import encode one
    // of the workspace's visible links, which stays.
    const ownsLink = Boolean(qrCode.linkId && qrCode.linkId > 0 && qrCode.link?.isQrCode);

    // Collect cache key before the transaction so we can invalidate after it commits
    let cacheKey: string | undefined;
    if (ownsLink && qrCode.link?.alias) {
      cacheKey = buildCacheKey(qrCode.link.domain, qrCode.link.alias);
    }

    // Delete QR code and its associated hidden link atomically
    await ctx.db.transaction(async (tx) => {
      await tx.delete(qrcode).where(eq(qrcode.id, id));

      if (ownsLink && qrCode.linkId) {
        await Promise.all([
          tx.delete(uniqueLinkVisit).where(eq(uniqueLinkVisit.linkId, qrCode.linkId)),
          tx.delete(linkVisit).where(eq(linkVisit.linkId, qrCode.linkId)),
        ]);
        await reserveLinkAliases(tx, eq(link.id, qrCode.linkId), "deleted");
        await tx.delete(link).where(eq(link.id, qrCode.linkId));
      }
    });

    // After the row is gone, so a logo shared with other import-made codes is seen as still used
    await deleteQrCodeImages(ctx.db, ctx.workspace, [qrCode]);

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
    where: and(eq(qrcode.id, id), workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId)),
    with: { link: true },
  });

  if (!qrCode) {
    throw new TRPCError({ code: "NOT_FOUND", message: "QR code not found." });
  }
  const { linkId, link: trackingLink } = qrCode;
  if (!linkId || !trackingLink) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This QR code has no associated link.",
    });
  }
  await requireQrCodeLinkAccess(ctx, trackingLink);

  return { ...qrCode, linkId, link: trackingLink };
}

export const updateQrCode = userFacing(
  "updateQrCode",
  "Something went wrong while updating your QR code. Please try again.",
  async (ctx: WorkspaceTRPCContext, input: QRCodeUpdateInput) => {
    const qrCode = await fetchQrCodeWithLink(ctx, input.id);

    const qrUpdates: Partial<Pick<typeof qrcode.$inferInsert, "title" | "content">> = {};
    if (input.title !== undefined) qrUpdates.title = input.title;
    if (input.url !== undefined) qrUpdates.content = input.url;

    // Apply the link update first so a failure there leaves both the live
    // redirect target and the QR metadata at their prior values. updateLink
    // runs the phishing check on a changed URL before it writes anything.
    const { id: _qrId, title, url, ...linkFields } = input;
    await updateLink(ctx, {
      id: qrCode.linkId,
      url,
      name: title,
      ...linkFields,
    });

    if (Object.keys(qrUpdates).length > 0) {
      await ctx.db.update(qrcode).set(qrUpdates).where(eq(qrcode.id, input.id));
    }

    return true;
  },
);

export const resetQrCodeStatistics = userFacing(
  "resetQrCodeStatistics",
  "Something went wrong while resetting statistics. Please try again.",
  async (ctx: WorkspaceTRPCContext, id: number) => {
    const qrCode = await fetchQrCodeWithLink(ctx, id);
    // A code made by a CSV import encodes one of the workspace's visible links; its visits are
    // every click on that link, not only scans, so they are not this code's to delete.
    if (!qrCode.link.isQrCode) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This QR code uses one of your links. Reset its statistics from the link instead.",
      });
    }

    // Delete both visit tables to fully reset stats (matches deleteQrCode cleanup), and clear
    // the click-limit counter so the limit restarts from what is left of the recorded total.
    await Promise.all([
      ctx.db.delete(linkVisit).where(eq(linkVisit.linkId, qrCode.linkId)),
      ctx.db.delete(uniqueLinkVisit).where(eq(uniqueLinkVisit.linkId, qrCode.linkId)),
      ctx.db.update(link).set({ clickLimitCount: null }).where(eq(link.id, qrCode.linkId)),
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

    if (input.logoImage) assertValidImageInput(input.logoImage);

    const insertResult = await ctx.db.insert(qrPreset).values({
      name: input.name,
      userId: ownership.userId ?? "",
      teamId: ownership.teamId,
      pixelStyle: input.pixelStyle,
      markerFrame: input.markerFrame,
      markerCenter: input.markerCenter,
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
        if (error instanceof TRPCError) throw error;
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
        await deleteImage(ctx.workspace, preset.logoImage);
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
          await deleteImage(ctx.workspace, preset.logoImage);
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
            await deleteImage(ctx.workspace, preset.logoImage);
          } catch (error) {
            log.error(
              { err: error, presetId: input.id, action: "replace-logo" },
              "failed to delete old logo image from R2",
            );
          }
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
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
        markerFrame: input.markerFrame,
        markerCenter: input.markerCenter,
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

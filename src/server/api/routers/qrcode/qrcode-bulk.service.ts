import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, sql } from "drizzle-orm";

import { getPlanCaps } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import { qrcode, qrPreset } from "@/server/db/schema";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";
import { deleteImage, isOwnedR2Url, uploadImage } from "@/server/lib/storage";
import { workspaceFilter, workspaceOwnership } from "@/server/lib/workspace";

import { bulkQrCodeLimitError, qrStyleFromPreset, toLegacyQrStyles } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { QRCodeStyle } from "@/lib/qr-generator/types";
import type { WorkspaceContext } from "@/server/lib/workspace";

// QR code counts and the codes the CSV link import creates (bulkCreateLinks in link.service).
// Kept apart from qrcode.service, which imports link.service.

const log = logger.child({ component: "qrcode-bulk.service" });

export type BulkQrCodePlan = { style: QRCodeStyle; logo: string | null };

/**
 * Checks, before a CSV import creates anything, that it may also create one QR code per row, and
 * resolves the style they are drawn with. Throws FORBIDDEN past the plan's limits.
 */
export async function countWorkspaceQrCodes(ctx: WorkspaceTRPCContext) {
  const [result] = await ctx.db
    .select({ count: count() })
    .from(qrcode)
    .where(workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId));
  return Number(result?.count ?? 0);
}

export async function prepareBulkQrCodes(
  ctx: WorkspaceTRPCContext,
  { rowCount, presetId }: { rowCount: number; presetId: number | null },
): Promise<BulkQrCodePlan> {
  // Team workspaces have Ultra features; limits apply to personal ones.
  const plan = ctx.workspace.type === "team" ? "ultra" : ctx.workspace.plan;
  const qrCodeCount =
    getPlanCaps(plan).qrCodeLimit === undefined ? 0 : await countWorkspaceQrCodes(ctx);
  const limitError = bulkQrCodeLimitError({ plan, rowCount, qrCodeCount });
  if (limitError) {
    await recordPlanLimitHit({ userId: ctx.auth.userId, limitKey: "bulk_qr_codes", plan });
    throw new TRPCError({ code: "FORBIDDEN", message: limitError });
  }

  const preset = presetId
    ? await ctx.db.query.qrPreset.findFirst({
        where: and(
          eq(qrPreset.id, presetId),
          workspaceFilter(ctx.workspace, qrPreset.userId, qrPreset.teamId),
        ),
      })
    : null;
  if (presetId && !preset) {
    throw new TRPCError({ code: "NOT_FOUND", message: "That QR style no longer exists." });
  }

  // The codes get their own copy of the preset's logo (uploaded once for the batch below), so
  // deleting the preset doesn't take their logo with it.
  let logo: string | null = null;
  if (preset?.logoImage) {
    if (preset.logoImage.startsWith("data:")) {
      logo = preset.logoImage;
    } else if (isOwnedR2Url(ctx.workspace, preset.logoImage)) {
      try {
        const response = await fetch(preset.logoImage);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const type = response.headers.get("Content-Type") ?? "image/png";
        const bytes = Buffer.from(await response.arrayBuffer());
        logo = `data:${type};base64,${bytes.toString("base64")}`;
      } catch (error) {
        log.warn({ err: error, presetId }, "failed to read preset logo for bulk QR codes");
      }
    }
  }

  const style = qrStyleFromPreset(preset ?? null, {
    seed: Math.round(Math.random() * 1_000_000),
    hasLogo: Boolean(logo),
  });
  return { style, logo };
}

export type BulkQrLink = { linkId: number; url: string; title: string };

/**
 * One QR code per imported link, encoding that link's short URL. The codes share the import's
 * style, including one logo uploaded for the whole batch; their PNG is drawn from the style on
 * demand, so no image is stored up front.
 */
export async function createBulkQrCodes(
  ctx: WorkspaceTRPCContext,
  { style, logo }: BulkQrCodePlan,
  links: BulkQrLink[],
) {
  if (links.length === 0) return [];
  const ownership = workspaceOwnership(ctx.workspace);
  const legacy = toLegacyQrStyles(style.pixelStyle, style.markerFrame);
  const color = /^#[0-9a-f]{6}/i.exec(style.darkColor)?.[0] ?? "#000000";

  // Keyed by the first link so no single code's own logo upload can overwrite it. Without storage
  // the upload hands the data URI back; the style never holds one (see saveQrCodeImage), so the
  // codes are then drawn without a logo.
  const uploaded = logo
    ? await uploadImage(ctx, {
        image: logo,
        resourceId: links[0]!.linkId,
        imageType: "qr-code-bulk-logo",
      })
    : undefined;
  const logoImage = uploaded && uploaded !== logo ? uploaded : null;

  await ctx.db.insert(qrcode).values(
    links.map((entry) => ({
      userId: ownership.userId,
      teamId: ownership.teamId,
      title: entry.title.slice(0, 255),
      color,
      content: entry.url,
      ...legacy,
      linkId: entry.linkId,
      contentType: "link" as const,
      style: { ...style, logoImage },
    })),
  );
  return ctx.db
    .select({ id: qrcode.id, linkId: qrcode.linkId })
    .from(qrcode)
    .where(
      and(
        workspaceFilter(ctx.workspace, qrcode.userId, qrcode.teamId),
        inArray(
          qrcode.linkId,
          links.map((entry) => entry.linkId),
        ),
      ),
    );
}

const logoImageOf = sql<string | null>`JSON_UNQUOTE(JSON_EXTRACT(${qrcode.style}, '$.logoImage'))`;

/**
 * Deletes the stored images of QR codes whose rows are already gone. A logo is kept while any
 * other code in the workspace still uses it: codes made by one CSV import share a single logo.
 */
export async function deleteQrCodeImages(
  db: WorkspaceTRPCContext["db"],
  workspace: WorkspaceContext,
  codes: { qrCode: string | null; style: QRCodeStyle | null }[],
) {
  const logoUrls = [
    ...new Set(
      codes.map((code) => code.style?.logoImage).filter((logo): logo is string => Boolean(logo)),
    ),
  ];
  const stillUsed =
    logoUrls.length === 0
      ? new Set<string>()
      : new Set(
          (
            await db
              .selectDistinct({ logo: logoImageOf })
              .from(qrcode)
              .where(
                and(
                  workspaceFilter(workspace, qrcode.userId, qrcode.teamId),
                  inArray(logoImageOf, logoUrls),
                ),
              )
          ).map((row) => row.logo),
        );

  const images = [
    ...codes.map((code) => code.qrCode),
    ...logoUrls.filter((logo) => !stillUsed.has(logo)),
  ];
  for (const image of images) {
    if (!image) continue;
    try {
      await deleteImage(workspace, image);
    } catch (error) {
      log.error({ err: error }, "failed to delete QR code image from R2");
    }
  }
}

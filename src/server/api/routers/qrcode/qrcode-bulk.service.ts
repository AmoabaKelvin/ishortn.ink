import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray } from "drizzle-orm";

import { getPlanCaps } from "@/lib/billing/plans";
import { logger } from "@/lib/logger";
import { qrcode, qrPreset } from "@/server/db/schema";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";
import { isOwnedR2Url, uploadImage } from "@/server/lib/storage";
import { workspaceFilter, workspaceOwnership } from "@/server/lib/workspace";

import { settleWithConcurrency } from "../link/utils";
import { bulkQrCodeLimitError, qrStyleFromPreset, toLegacyQrStyles } from "./utils";

import type { WorkspaceTRPCContext } from "../../trpc";
import type { QRCodeStyle } from "@/lib/qr-generator/types";

// QR code counts and the codes the CSV link import creates (bulkCreateLinks in link.service).
// Kept apart from qrcode.service, which imports link.service.

const log = logger.child({ component: "qrcode-bulk.service" });

export type BulkQrCodePlan = { style: QRCodeStyle; logo: string | null };

const BULK_QR_LOGO_CONCURRENCY = 6;

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

  // Each code keeps its own copy of the logo (deleting a code deletes its logo), so read the
  // preset's stored logo once and upload it per code below.
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
 * style; their PNG is drawn from it on demand, so no image is stored up front.
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
      style,
    })),
  );
  const rows = await ctx.db
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

  if (logo) {
    await settleWithConcurrency(rows, BULK_QR_LOGO_CONCURRENCY, async (row) => {
      const url = await uploadImage(ctx, {
        image: logo,
        resourceId: row.id,
        imageType: "qr-code-logo",
      });
      // Without storage the upload hands the data URI back; the style never holds one (see
      // saveQrCodeImage), so that code is drawn without its logo.
      if (!url || url === logo) return;
      await ctx.db
        .update(qrcode)
        .set({ style: { ...style, logoImage: url } })
        .where(eq(qrcode.id, row.id));
    });
  }

  return rows;
}

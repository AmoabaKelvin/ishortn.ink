import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { consumeRateLimit } from "@/app/api/v1/rate-limit";
import {
  EMAIL_CAPTURE_DEFAULT_BUTTON,
  EMAIL_CAPTURE_DEFAULT_HEADING,
  EMAIL_CAPTURE_DEFAULT_SUCCESS,
  parseEmailCapture,
  serializeEmailCapture,
  subscriberEmailSchema,
} from "@/components/bio/email-capture";
import {
  oembedUrl,
  parseEmbedUrl,
  type EmbedDetails,
  type EmbedProvider,
  type ParsedEmbed,
} from "@/components/bio/embed";
import { parseEmbed, serializeEmbed } from "@/components/bio/embed-content";
import { normalizeSocialUrl } from "@/components/bio/social-links";
import {
  buildWhatsAppUrl,
  parseWhatsApp,
  serializeWhatsApp,
  WHATSAPP_DEFAULT_LABEL,
} from "@/components/bio/whatsapp";
import {
  canRemoveBioBranding,
  canScheduleBioBlocks,
  canUseBioCustomDomain,
  canUseBioCustomThemes,
  canUseBioImageBlocks,
  getPlanCaps,
} from "@/lib/billing/plans";
import { getAppBaseDomain, isPlatformDomain } from "@/lib/constants/domains";
import { fillClickSeries } from "@/lib/core/analytics";
import { baseDomain } from "@/lib/core/analytics/referrer";
import {
  bioBlock,
  bioPage,
  bioPageView,
  bioPageViewDailySummary,
  bioSubscriber,
  link,
  linkVisit,
  uniqueBioPageView,
  user,
} from "@/server/db/schema";
import { recordSafetyFollowUp } from "@/server/lib/phishing/follow-up";
import { checkCampaignPatternsAfterResponse } from "@/server/lib/phishing/rescan";
import { recordPlanLimitHit } from "@/server/lib/plan-limit-hits";
import { deleteImage, isOwnedR2Url, uploadImage } from "@/server/lib/storage";
import {
  deleteHiddenTrackingLink,
  insertHiddenTrackingLink,
  prepareHiddenTrackingLink,
  purgeTrackingLinkCache,
  updateHiddenTrackingLink,
  type PreparedTrackingLink,
} from "@/server/lib/tracking-link";
import { requirePermission, workspaceFilter, workspaceOwnership } from "@/server/lib/workspace";

import { assertDomainAllowed } from "../link/utils";
import {
  assertSlugAllowed,
  buildBreakdown,
  checkBioPageLimit,
  countryLabel,
  deviceLabel,
  lockBioBlockCapacity,
  precheckBioBlockCapacity,
  pageBelongsToWorkspace,
  MAX_SUBSCRIBER_EXPORT_ROWS,
  referrerHostLabel,
  rethrowBioDuplicate,
  sameBioTheme,
  subscribersToCsv,
} from "./utils";

import type { PublicTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type {
  AddBioBlockInput,
  CreateBioPageInput,
  ListSubscribersInput,
  SubscribeInput,
  ReorderBlocksInput,
  UpdateBioBlockInput,
  UpdateBioPageInput,
} from "./bio-page.input";
import type { CounterStore } from "@/app/api/v1/rate-limit";
import type { BioBlock, BioPageTheme, BioSocialLink } from "@/server/db/schema";
import type { ImageType } from "@/server/lib/storage/types";
import type { MySqlColumn } from "drizzle-orm/mysql-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function forbidden(message: string): TRPCError {
  return new TRPCError({ code: "FORBIDDEN", message });
}

/**
 * On-demand revalidation of a page's public route after an edit. The custom-
 * domain route is force-dynamic, so only the ISR /p/[slug] route needs busting.
 * Wrapped in try/catch since mutations could theoretically run outside a
 * request context (ISR's 60s window is the fallback either way).
 */
function revalidateBioPath(slug: string): void {
  try {
    revalidatePath(`/p/${slug}`);
  } catch {
    // not in a revalidatable context
  }
}

const storedSocialsSchema = z.array(z.object({ platform: z.string(), url: z.string() }));

function parseSocials(content: string | null): BioSocialLink[] {
  if (!content) return [];
  try {
    const parsed = storedSocialsSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

// Canonicalize each social entry to a real href before storing, so the public
// renderer can use the value directly. Rejects entries that can't be resolved
// (e.g. a non-email typed for the Email platform) with a clear message.
function normalizeSocials(socials: BioSocialLink[]): BioSocialLink[] {
  return socials.map((s) => {
    const url = normalizeSocialUrl(s.platform, s.url);
    if (!url) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          s.platform === "email"
            ? "Enter a valid email address for the Email link."
            : `Enter a valid handle or URL for the ${s.platform} link.`,
      });
    }
    return { platform: s.platform, url };
  });
}

function themeHasCustomization(theme: BioPageTheme): boolean {
  return Boolean(theme.accentColor || theme.background || theme.font || theme.buttonStyle);
}

function assertSchedulingAllowed(
  ctx: WorkspaceTRPCContext,
  scheduledAt?: Date | null,
  scheduledUntil?: Date | null,
): void {
  if ((scheduledAt || scheduledUntil) && !canScheduleBioBlocks(ctx.workspace.plan)) {
    throw forbidden("Scheduled blocks are available on the Ultra plan.");
  }
}

function resolveEmbed(url: string | null | undefined): ParsedEmbed {
  const result = parseEmbedUrl(url ?? "");
  if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
  return result.embed;
}

const oembedSchema = z.object({ title: z.string() });

/**
 * The provider's title for an embed, used when the block has none of its own.
 * Best effort: a slow or failing provider only costs the title, never the add.
 */
async function fetchEmbedTitle(embed: ParsedEmbed): Promise<string | undefined> {
  const endpoint = oembedUrl(embed);
  if (!endpoint) return undefined;
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return undefined;
    const parsed = oembedSchema.safeParse(await res.json());
    return parsed.success ? parsed.data.title.trim().slice(0, 255) || undefined : undefined;
  } catch {
    return undefined;
  }
}

async function embedDetails(embed: ParsedEmbed): Promise<EmbedDetails> {
  const title = await fetchEmbedTitle(embed);
  return { provider: embed.provider, embedId: embed.embedId, title };
}

async function assertImageBlocksAllowed(ctx: WorkspaceTRPCContext): Promise<void> {
  if (canUseBioImageBlocks(ctx.workspace.plan)) return;
  await recordPlanLimitHit({
    userId: ctx.auth.userId,
    limitKey: "bio_image_blocks",
    plan: ctx.workspace.plan,
  });
  throw forbidden("Image blocks are available on Pro and Ultra plans.");
}

// Block images are keyed by upload time rather than block id: the id doesn't
// exist yet when a block is added, and a replaced image gets a fresh URL
// instead of overwriting one that browsers and the CDN have cached.
const uploadBlockImage = (ctx: WorkspaceTRPCContext, image: string, previous: string | null) =>
  resolveImageUpdate(ctx, Date.now(), "bio-block", image, previous);

/**
 * Upload a new bio image (or clear it) and remove the previous R2 object when it
 * changed. Returns the value to persist.
 *
 * Bio images are rendered server-side by next/og, which fetches whatever `src`
 * holds — so an arbitrary URL here is a server-side request from inside our
 * network. The client only ever sends a base64 data URL (new upload) or the
 * previously stored value, so anything else that already looks like an absolute
 * URL is refused.
 */
async function resolveImageUpdate(
  ctx: WorkspaceTRPCContext,
  resourceId: number,
  imageType: ImageType,
  next: string | null | undefined,
  previous: string | null,
): Promise<{ value: string | null; previousToDelete: string | null }> {
  if (next && /^[a-z][a-z0-9+.-]*:/i.test(next) && !next.startsWith("data:image/")) {
    if (next !== previous && !isOwnedR2Url(ctx.workspace, next)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Bio images must be uploaded, not linked from another site.",
      });
    }
  }

  const value = next
    ? ((await uploadImage(ctx, { image: next, resourceId, imageType })) ?? next)
    : null;
  // Return the old object instead of deleting it here, so the caller can clean
  // up only after the new value is committed to the DB.
  return { value, previousToDelete: previous && previous !== value ? previous : null };
}

async function fetchBioPageForWorkspace(ctx: WorkspaceTRPCContext, id: number) {
  const page = await ctx.db.query.bioPage.findFirst({
    where: and(eq(bioPage.id, id), workspaceFilter(ctx.workspace, bioPage.userId, bioPage.teamId)),
  });
  if (!page) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Bio page not found." });
  }
  return page;
}

async function fetchBlockForWorkspace(ctx: WorkspaceTRPCContext, blockId: number) {
  const block = await ctx.db.query.bioBlock.findFirst({
    where: eq(bioBlock.id, blockId),
    with: { bioPage: true },
  });
  if (!block || !block.bioPage || !pageBelongsToWorkspace(ctx, block.bioPage)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Block not found." });
  }
  return block;
}

// ---------------------------------------------------------------------------
// Page CRUD
// ---------------------------------------------------------------------------

export async function listBioPages(ctx: WorkspaceTRPCContext) {
  const pages = await ctx.db.query.bioPage.findMany({
    where: workspaceFilter(ctx.workspace, bioPage.userId, bioPage.teamId),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  const ids = pages.map((p) => p.id);
  const counts = ids.length
    ? await ctx.db
        .select({ bioPageId: bioBlock.bioPageId, count: count() })
        .from(bioBlock)
        .where(inArray(bioBlock.bioPageId, ids))
        .groupBy(bioBlock.bioPageId)
    : [];
  const countMap = new Map(counts.map((c) => [c.bioPageId, Number(c.count)]));

  return pages.map((p) => ({ ...p, blockCount: countMap.get(p.id) ?? 0 }));
}

function toEditorBlock(
  b: BioBlock,
  linkMap: Map<number, { domain: string; alias: string | null; blocked: boolean | null }>,
) {
  const trackingLink = b.linkId ? linkMap.get(b.linkId) : undefined;
  const whatsapp = b.type === "link" ? parseWhatsApp(b.content) : null;
  return {
    id: b.id,
    type: whatsapp ? ("whatsapp" as const) : b.type,
    title: b.title,
    content: b.content,
    url: b.url,
    isVisible: b.isVisible,
    position: b.position,
    scheduledAt: b.scheduledAt,
    scheduledUntil: b.scheduledUntil,
    socials: b.type === "social" ? parseSocials(b.content) : undefined,
    whatsapp,
    embed: b.type === "embed" ? parseEmbed(b.content) : null,
    emailCapture: b.type === "email_capture" ? parseEmailCapture(b.content) : null,
    imageWidth: b.imageWidth,
    imageHeight: b.imageHeight,
    shortUrl: trackingLink?.alias ? `https://${trackingLink.domain}/${trackingLink.alias}` : null,
    blocked: trackingLink?.blocked ?? false,
  };
}

export async function getBioPage(ctx: WorkspaceTRPCContext, id: number) {
  const page = await fetchBioPageForWorkspace(ctx, id);
  const blocks = await ctx.db.query.bioBlock.findMany({
    where: eq(bioBlock.bioPageId, id),
    orderBy: (t, { asc }) => [asc(t.position)],
  });

  const linkIds = blocks.map((b) => b.linkId).filter((x): x is number => !!x);
  const links = linkIds.length
    ? await ctx.db.query.link.findMany({ where: inArray(link.id, linkIds) })
    : [];
  const linkMap = new Map(
    links.map((l) => [l.id, { domain: l.domain, alias: l.alias, blocked: l.blocked }]),
  );

  return { ...page, blocks: blocks.map((b) => toEditorBlock(b, linkMap)) };
}

export async function createBioPage(ctx: WorkspaceTRPCContext, input: CreateBioPageInput) {
  requirePermission(ctx.workspace, "bio.create", "create bio pages");
  assertSlugAllowed(input.slug);
  await checkBioPageLimit(ctx);

  const ownership = workspaceOwnership(ctx.workspace);
  try {
    const [res] = await ctx.db.insert(bioPage).values({
      slug: input.slug,
      title: input.title ?? null,
      description: input.description ?? null,
      userId: ownership.userId,
      teamId: ownership.teamId,
      createdByUserId: ctx.auth.userId,
    });
    return { id: Number(res.insertId), slug: input.slug };
  } catch (error) {
    if (error instanceof Error) rethrowBioDuplicate(error);
    throw error;
  }
}

export async function updateBioPage(ctx: WorkspaceTRPCContext, input: UpdateBioPageInput) {
  const page = await fetchBioPageForWorkspace(ctx, input.id);
  requirePermission(ctx.workspace, "bio.edit", "edit bio pages");
  const plan = ctx.workspace.plan;
  const updates: Partial<typeof bioPage.$inferInsert> = {};

  if (input.slug !== undefined) {
    assertSlugAllowed(input.slug);
    updates.slug = input.slug;
  }
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.seoTitle !== undefined) updates.seoTitle = input.seoTitle;
  if (input.seoDescription !== undefined) updates.seoDescription = input.seoDescription;

  // Paid options can't be added or changed below their plan; values the editor
  // resends unchanged (or removes) still save, so a downgraded page stays editable.
  if (input.removeBranding !== undefined) {
    if (input.removeBranding && !page.removeBranding && !canRemoveBioBranding(plan)) {
      throw forbidden("Removing iShortn branding is available on Pro and Ultra plans.");
    }
    updates.removeBranding = input.removeBranding;
  }

  if (input.theme !== undefined) {
    if (
      input.theme &&
      themeHasCustomization(input.theme) &&
      !sameBioTheme(input.theme, page.theme) &&
      !canUseBioCustomThemes(plan)
    ) {
      throw forbidden("Theme customization is available on Pro and Ultra plans.");
    }
    updates.theme = input.theme ?? null;
  }

  if (input.customDomain !== undefined) {
    const unchanged =
      !!input.customDomain &&
      input.customDomain
        .trim()
        .toLowerCase()
        .replace(/^www\./, "") === page.customDomain;
    if (input.customDomain && !unchanged) {
      if (!canUseBioCustomDomain(plan)) {
        throw forbidden("Custom domains for bio pages are available on Pro and Ultra plans.");
      }
      // Canonicalize the same way getByDomain looks it up (lowercase, no www),
      // so a domain saved as "www.brand.com" still resolves at "brand.com".
      const normalized = input.customDomain
        .trim()
        .toLowerCase()
        .replace(/^www\./, "");
      if (isPlatformDomain(normalized)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use a custom domain you own, not the platform domain.",
        });
      }
      await assertDomainAllowed(ctx, normalized); // must be a verified domain in this workspace
      updates.customDomain = normalized;
    } else if (!input.customDomain) {
      updates.customDomain = null;
    }
  }

  const imagesToDelete: string[] = [];
  if (input.avatarUrl !== undefined) {
    const { value, previousToDelete } = await resolveImageUpdate(
      ctx,
      page.id,
      "bio-avatar",
      input.avatarUrl,
      page.avatarUrl,
    );
    updates.avatarUrl = value;
    if (previousToDelete) imagesToDelete.push(previousToDelete);
  }
  if (input.socialImageUrl !== undefined) {
    const { value, previousToDelete } = await resolveImageUpdate(
      ctx,
      page.id,
      "bio-og",
      input.socialImageUrl,
      page.socialImageUrl,
    );
    updates.socialImageUrl = value;
    if (previousToDelete) imagesToDelete.push(previousToDelete);
  }

  if (Object.keys(updates).length > 0) {
    try {
      await ctx.db.update(bioPage).set(updates).where(eq(bioPage.id, page.id));
    } catch (error) {
      if (error instanceof Error) rethrowBioDuplicate(error);
      throw error;
    }
  }

  // Only after the row is updated do we delete replaced images, so a failed
  // update (e.g. duplicate slug) never strands the page on a deleted image.
  for (const url of imagesToDelete) await deleteImage(ctx.workspace, url).catch(() => {});
  revalidateBioPath(page.slug);
  if (updates.slug && updates.slug !== page.slug) revalidateBioPath(updates.slug);
  return { success: true };
}

export async function togglePublished(
  ctx: WorkspaceTRPCContext,
  input: { id: number; isPublished: boolean },
) {
  const page = await fetchBioPageForWorkspace(ctx, input.id);
  requirePermission(ctx.workspace, "bio.edit", "edit bio pages");
  await ctx.db
    .update(bioPage)
    .set({ isPublished: input.isPublished })
    .where(eq(bioPage.id, page.id));
  revalidateBioPath(page.slug);
  return { success: true, isPublished: input.isPublished };
}

export async function deleteBioPage(ctx: WorkspaceTRPCContext, id: number) {
  const page = await fetchBioPageForWorkspace(ctx, id);
  requirePermission(ctx.workspace, "bio.delete", "delete bio pages");

  const blocks = await ctx.db.query.bioBlock.findMany({ where: eq(bioBlock.bioPageId, page.id) });
  const linkIds = blocks.map((b) => b.linkId).filter((x): x is number => !!x);
  const backingLinks = linkIds.length
    ? await ctx.db.query.link.findMany({ where: inArray(link.id, linkIds) })
    : [];

  await ctx.db.transaction(async (tx) => {
    for (const linkId of linkIds) {
      await deleteHiddenTrackingLink(tx, linkId);
    }
    await tx.delete(bioBlock).where(eq(bioBlock.bioPageId, page.id));
    await tx.delete(bioPageView).where(eq(bioPageView.bioPageId, page.id));
    await tx.delete(uniqueBioPageView).where(eq(uniqueBioPageView.bioPageId, page.id));
    await tx.delete(bioPageViewDailySummary).where(eq(bioPageViewDailySummary.bioPageId, page.id));
    await tx.delete(bioSubscriber).where(eq(bioSubscriber.bioPageId, page.id));
    await tx.delete(bioPage).where(eq(bioPage.id, page.id));
  });

  for (const l of backingLinks) {
    if (l.alias) purgeTrackingLinkCache(l.domain, l.alias);
  }

  // Remove the page's images from R2 (no-op for non-R2/base64 values).
  const blockImages = blocks.filter((b) => b.type === "image").map((b) => b.content);
  await Promise.all(
    [page.avatarUrl, page.socialImageUrl, ...blockImages]
      .filter((url): url is string => !!url)
      .map((url) => deleteImage(ctx.workspace, url).catch(() => {})),
  );

  revalidateBioPath(page.slug);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Block CRUD
// ---------------------------------------------------------------------------

export async function addBlock(ctx: WorkspaceTRPCContext, input: AddBioBlockInput) {
  const page = await fetchBioPageForWorkspace(ctx, input.bioPageId);
  requirePermission(ctx.workspace, "bio.edit", "edit bio pages");
  assertSchedulingAllowed(ctx, input.scheduledAt, input.scheduledUntil);

  const [row] = await ctx.db
    .select({ maxPos: sql<number>`COALESCE(MAX(${bioBlock.position}), -1)` })
    .from(bioBlock)
    .where(eq(bioBlock.bioPageId, page.id));
  const position = Number(row?.maxPos ?? -1) + 1;

  const content =
    input.type === "social"
      ? JSON.stringify(normalizeSocials(input.socials ?? []))
      : (input.content ?? null);

  const whatsapp = input.type === "whatsapp" ? input.whatsapp : undefined;
  if (input.type === "whatsapp" && !whatsapp) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A WhatsApp block needs a phone number.",
    });
  }

  if (input.type === "link" || input.type === "whatsapp") {
    const destination = whatsapp ? buildWhatsAppUrl(whatsapp) : input.url?.trim();
    if (!destination) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A link block needs a destination URL.",
      });
    }
    const prepared = await prepareHiddenTrackingLink(ctx, {
      url: destination,
      name: input.title || page.title || "Bio link",
      kind: "bio",
    });
    const { id, linkId } = await ctx.db.transaction(async (tx) => {
      await lockBioBlockCapacity(tx, ctx.workspace.plan, page.id, ctx.auth.userId, "link");
      const linkId = await insertHiddenTrackingLink(tx, ctx, prepared);
      const [res] = await tx.insert(bioBlock).values({
        bioPageId: page.id,
        type: "link",
        title: input.title ?? null,
        content: whatsapp ? serializeWhatsApp(whatsapp) : null,
        url: destination,
        linkId,
        position,
        scheduledAt: input.scheduledAt ?? null,
        scheduledUntil: input.scheduledUntil ?? null,
      });
      return { id: Number(res.insertId), linkId };
    });
    recordSafetyFollowUp(linkId, prepared.safety);
    checkCampaignPatternsAfterResponse([{ linkId, url: destination }]);
    revalidateBioPath(page.slug);
    return { id };
  }

  if (input.type === "embed") {
    const embed = resolveEmbed(input.url);
    // Fail a full page before waiting on the provider's oEmbed request.
    await precheckBioBlockCapacity(ctx.db, ctx.workspace.plan, page.id, ctx.auth.userId, "embed");
    const details = await embedDetails(embed);
    const id = await ctx.db.transaction(async (tx) => {
      await lockBioBlockCapacity(tx, ctx.workspace.plan, page.id, ctx.auth.userId, "embed");
      const [res] = await tx.insert(bioBlock).values({
        bioPageId: page.id,
        type: "embed",
        title: input.title?.trim() || null,
        content: serializeEmbed(details),
        url: embed.sourceUrl,
        position,
        scheduledAt: input.scheduledAt ?? null,
        scheduledUntil: input.scheduledUntil ?? null,
      });
      return Number(res.insertId);
    });
    revalidateBioPath(page.slug);
    return { id };
  }

  if (input.type === "email_capture") {
    const id = await ctx.db.transaction(async (tx) => {
      await lockBioBlockCapacity(tx, ctx.workspace.plan, page.id, ctx.auth.userId, "email_capture");
      const [res] = await tx.insert(bioBlock).values({
        bioPageId: page.id,
        type: "email_capture",
        title: input.title?.trim() || null,
        content: serializeEmailCapture(
          input.emailCapture ?? { buttonLabel: "", successMessage: "", consentText: "" },
        ),
        position,
        scheduledAt: input.scheduledAt ?? null,
        scheduledUntil: input.scheduledUntil ?? null,
      });
      return Number(res.insertId);
    });
    revalidateBioPath(page.slug);
    return { id };
  }

  if (input.type === "image") {
    await assertImageBlocksAllowed(ctx);
    if (!input.image) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "An image block needs an image." });
    }
    const destination = input.url?.trim() || null;
    // The safety scan runs before the upload, so a refused link leaves no object behind.
    const prepared = destination
      ? await prepareHiddenTrackingLink(ctx, {
          url: destination,
          name: input.title || page.title || "Bio image",
          kind: "bio-image",
        })
      : null;
    const { value: src } = await uploadBlockImage(ctx, input.image, null);
    let inserted: { id: number; linkId: number | null };
    try {
      inserted = await ctx.db.transaction(async (tx) => {
        const linkId = prepared ? await insertHiddenTrackingLink(tx, ctx, prepared) : null;
        const [res] = await tx.insert(bioBlock).values({
          bioPageId: page.id,
          type: "image",
          title: input.title?.trim() || null,
          content: src,
          url: destination,
          linkId,
          imageWidth: input.imageWidth ?? null,
          imageHeight: input.imageHeight ?? null,
          position,
          scheduledAt: input.scheduledAt ?? null,
          scheduledUntil: input.scheduledUntil ?? null,
        });
        return { id: Number(res.insertId), linkId };
      });
    } catch (error) {
      if (src) await deleteImage(ctx.workspace, src).catch(() => {});
      throw error;
    }
    if (prepared && inserted.linkId && destination) {
      recordSafetyFollowUp(inserted.linkId, prepared.safety);
      checkCampaignPatternsAfterResponse([{ linkId: inserted.linkId, url: destination }]);
    }
    revalidateBioPath(page.slug);
    return { id: inserted.id };
  }

  const [res] = await ctx.db.insert(bioBlock).values({
    bioPageId: page.id,
    type: input.type,
    title: input.title ?? null,
    content,
    url: input.url ?? null,
    position,
    scheduledAt: input.scheduledAt ?? null,
    scheduledUntil: input.scheduledUntil ?? null,
  });
  revalidateBioPath(page.slug);
  return { id: Number(res.insertId) };
}

export async function updateBlock(ctx: WorkspaceTRPCContext, input: UpdateBioBlockInput) {
  const block = await fetchBlockForWorkspace(ctx, input.id);
  requirePermission(ctx.workspace, "bio.edit", "edit bio pages");
  // A schedule resent unchanged doesn't need the plan; setting or changing one does.
  const sameTime = (a?: Date | null, b?: Date | null) =>
    (a?.getTime() ?? null) === (b?.getTime() ?? null);
  assertSchedulingAllowed(
    ctx,
    sameTime(input.scheduledAt, block.scheduledAt) ? null : input.scheduledAt,
    sameTime(input.scheduledUntil, block.scheduledUntil) ? null : input.scheduledUntil,
  );

  const updates: Partial<typeof bioBlock.$inferInsert> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.isVisible !== undefined) updates.isVisible = input.isVisible;
  if (input.scheduledAt !== undefined) updates.scheduledAt = input.scheduledAt;
  if (input.scheduledUntil !== undefined) updates.scheduledUntil = input.scheduledUntil;

  if (block.type === "embed") {
    if (input.url !== undefined) {
      const embed = resolveEmbed(input.url);
      const stored = parseEmbed(block.content);
      // Only a different item needs a new provider title.
      if (stored?.provider !== embed.provider || stored.embedId !== embed.embedId) {
        updates.content = serializeEmbed(await embedDetails(embed));
      }
      updates.url = embed.sourceUrl;
    }
  } else if (block.type === "image") {
    return updateImageBlock(ctx, block, input, updates);
  } else if (block.type === "email_capture") {
    if (input.emailCapture) updates.content = serializeEmailCapture(input.emailCapture);
  } else {
    // A link block's content only ever holds its WhatsApp details, so it changes
    // through `whatsapp` and the destination is rebuilt from them.
    const isWhatsApp = block.type === "link" && parseWhatsApp(block.content) !== null;
    const url = isWhatsApp ? input.whatsapp && buildWhatsAppUrl(input.whatsapp) : input.url;

    if (block.type === "social") {
      if (input.socials !== undefined)
        updates.content = JSON.stringify(normalizeSocials(input.socials));
    } else if (isWhatsApp) {
      if (input.whatsapp) updates.content = serializeWhatsApp(input.whatsapp);
    } else if (input.content !== undefined && block.type !== "link") {
      updates.content = input.content;
    }

    if (url !== undefined) {
      updates.url = url;
      if (block.type === "link" && block.linkId && url) {
        await updateHiddenTrackingLink(ctx, block.linkId, {
          url,
          name: input.title ?? block.title ?? undefined,
        });
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await ctx.db.update(bioBlock).set(updates).where(eq(bioBlock.id, block.id));
  }
  revalidateBioPath(block.bioPage.slug);
  return { success: true };
}

/**
 * Image blocks: the image goes through the same upload path as the avatar, and
 * the optional destination gets, keeps or loses its hidden tracking link. Plan
 * checks only apply to adding the block, so a downgraded page stays editable.
 */
async function updateImageBlock(
  ctx: WorkspaceTRPCContext,
  block: Awaited<ReturnType<typeof fetchBlockForWorkspace>>,
  input: UpdateBioBlockInput,
  updates: Partial<typeof bioBlock.$inferInsert>,
) {
  if (input.image === null || input.image === "") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "An image block needs an image." });
  }

  const destination = input.url === undefined ? undefined : input.url?.trim() || null;
  let prepared: PreparedTrackingLink | null = null;
  let removedLinkId: number | null = null;
  if (destination !== undefined && destination !== block.url) {
    updates.url = destination;
    if (destination && block.linkId) {
      await updateHiddenTrackingLink(ctx, block.linkId, {
        url: destination,
        name: input.title ?? block.title ?? undefined,
      });
    } else if (destination) {
      prepared = await prepareHiddenTrackingLink(ctx, {
        url: destination,
        name: input.title || block.bioPage.title || "Bio image",
        kind: "bio-image",
      });
    } else if (block.linkId) {
      removedLinkId = block.linkId;
    }
  }
  const removedLink = removedLinkId
    ? await ctx.db.query.link.findFirst({ where: eq(link.id, removedLinkId) })
    : undefined;

  let previousImage: string | null = null;
  if (input.image !== undefined) {
    const { value, previousToDelete } = await uploadBlockImage(ctx, input.image, block.content);
    updates.content = value;
    updates.imageWidth = input.imageWidth ?? null;
    updates.imageHeight = input.imageHeight ?? null;
    previousImage = previousToDelete;
  }

  let addedLinkId: number | null = null;
  try {
    await ctx.db.transaction(async (tx) => {
      // The link decisions above were made from an unlocked read; a concurrent
      // save that added or removed the link since would orphan one or double-delete.
      const [current] = await tx
        .select({ linkId: bioBlock.linkId })
        .from(bioBlock)
        .where(eq(bioBlock.id, block.id))
        .for("update");
      if (!current || current.linkId !== block.linkId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This block was changed somewhere else. Reload the page and try again.",
        });
      }
      if (prepared) {
        addedLinkId = await insertHiddenTrackingLink(tx, ctx, prepared);
        updates.linkId = addedLinkId;
      }
      if (removedLinkId) {
        await deleteHiddenTrackingLink(tx, removedLinkId);
        updates.linkId = null;
      }
      if (Object.keys(updates).length > 0) {
        await tx.update(bioBlock).set(updates).where(eq(bioBlock.id, block.id));
      }
    });
  } catch (error) {
    // Drop a freshly uploaded image the row never pointed at.
    if (updates.content && updates.content !== block.content) {
      await deleteImage(ctx.workspace, updates.content).catch(() => {});
    }
    throw error;
  }

  if (prepared && addedLinkId && destination) {
    recordSafetyFollowUp(addedLinkId, prepared.safety);
    checkCampaignPatternsAfterResponse([{ linkId: addedLinkId, url: destination }]);
  }
  if (removedLink?.alias) purgeTrackingLinkCache(removedLink.domain, removedLink.alias);
  if (previousImage) await deleteImage(ctx.workspace, previousImage).catch(() => {});
  revalidateBioPath(block.bioPage.slug);
  return { success: true };
}

export async function deleteBlock(ctx: WorkspaceTRPCContext, id: number) {
  const block = await fetchBlockForWorkspace(ctx, id);
  requirePermission(ctx.workspace, "bio.edit", "edit bio pages");

  // Link blocks and linked image blocks own a hidden tracking link.
  if (block.linkId) {
    const linkId = block.linkId;
    const backing = await ctx.db.query.link.findFirst({ where: eq(link.id, linkId) });
    await ctx.db.transaction(async (tx) => {
      await deleteHiddenTrackingLink(tx, linkId);
      await tx.delete(bioBlock).where(eq(bioBlock.id, id));
    });
    if (backing?.alias) purgeTrackingLinkCache(backing.domain, backing.alias);
  } else {
    await ctx.db.delete(bioBlock).where(eq(bioBlock.id, id));
  }
  if (block.type === "image" && block.content) {
    await deleteImage(ctx.workspace, block.content).catch(() => {});
  }
  revalidateBioPath(block.bioPage.slug);
  return { success: true };
}

export async function reorderBlocks(ctx: WorkspaceTRPCContext, input: ReorderBlocksInput) {
  const page = await fetchBioPageForWorkspace(ctx, input.bioPageId);
  requirePermission(ctx.workspace, "bio.edit", "edit bio pages");
  const blocks = await ctx.db.query.bioBlock.findMany({
    where: eq(bioBlock.bioPageId, page.id),
    columns: { id: true },
  });
  const validIds = new Set(blocks.map((b) => b.id));
  const seen = new Set<number>();
  const ordered = input.blockIds.filter(
    (id) => validIds.has(id) && !seen.has(id) && (seen.add(id), true),
  );
  // The client always sends the full ordering; a partial or duplicated payload
  // would leave some blocks with stale positions, so reject it outright.
  if (ordered.length !== validIds.size) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Reorder must include every block exactly once.",
    });
  }

  await ctx.db.transaction(async (tx) => {
    for (let i = 0; i < ordered.length; i++) {
      await tx.update(bioBlock).set({ position: i }).where(eq(bioBlock.id, ordered[i]!));
    }
  });
  revalidateBioPath(page.slug);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Public rendering
// ---------------------------------------------------------------------------

export type PublicBioBlock =
  | { id: number; type: "link"; title: string | null; href: string }
  | { id: number; type: "whatsapp"; title: string | null; href: string }
  | { id: number; type: "email"; title: string | null; href: string | null }
  | { id: number; type: "social"; socials: BioSocialLink[] }
  | {
      id: number;
      type: "embed";
      title: string | null;
      provider: EmbedProvider;
      embedId: string;
    }
  | {
      id: number;
      type: "image";
      src: string;
      alt: string | null;
      href: string | null;
      width: number | null;
      height: number | null;
    }
  | {
      id: number;
      type: "email_capture";
      heading: string;
      buttonLabel: string;
      successMessage: string;
      consentText: string | null;
    }
  | {
      id: number;
      type: "heading" | "text" | "divider";
      title: string | null;
      content: string | null;
    };

export type PublicBioPage = {
  id: number;
  slug: string;
  title: string | null;
  description: string | null;
  avatarUrl: string | null;
  theme: BioPageTheme | null;
  removeBranding: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  socialImageUrl: string | null;
  customDomain: string | null;
  blocks: PublicBioBlock[];
};

function isBlockLive(block: BioBlock, now: number): boolean {
  if (!block.isVisible) return false;
  if (block.scheduledAt && block.scheduledAt.getTime() > now) return false;
  if (block.scheduledUntil && block.scheduledUntil.getTime() <= now) return false;
  return true;
}

async function assemblePublicBioPage(
  db: PublicTRPCContext["db"],
  page: typeof bioPage.$inferSelect,
): Promise<PublicBioPage> {
  const blocks = await db.query.bioBlock.findMany({
    where: eq(bioBlock.bioPageId, page.id),
    orderBy: (t, { asc }) => [asc(t.position)],
  });

  const now = Date.now();
  const live = blocks.filter((b) => isBlockLive(b, now));

  const linkIds = live.map((b) => b.linkId).filter((x): x is number => !!x);
  const links = linkIds.length
    ? await db.query.link.findMany({ where: inArray(link.id, linkIds) })
    : [];
  const linkMap = new Map(links.map((l) => [l.id, l]));
  // A blocked/disabled or missing backing link hides its block entirely.
  const liveShortUrl = (linkId: number | null) => {
    const l = linkId ? linkMap.get(linkId) : undefined;
    return l && !l.blocked && !l.disabled && l.alias ? `https://${l.domain}/${l.alias}` : null;
  };

  const publicBlocks: PublicBioBlock[] = live
    .map((b): PublicBioBlock | null => {
      if (b.type === "link") {
        const href = liveShortUrl(b.linkId);
        if (!href) return null;
        const type = parseWhatsApp(b.content) ? "whatsapp" : "link";
        return { id: b.id, type, title: b.title, href };
      }
      if (b.type === "image") {
        const href = b.linkId ? liveShortUrl(b.linkId) : null;
        if (!b.content || (b.linkId && !href)) return null;
        return {
          id: b.id,
          type: "image",
          src: b.content,
          alt: b.title,
          href,
          width: b.imageWidth,
          height: b.imageHeight,
        };
      }
      if (b.type === "embed") {
        const embed = parseEmbed(b.content);
        if (!embed) return null;
        return {
          id: b.id,
          type: "embed",
          title: b.title || embed.title || null,
          provider: embed.provider,
          embedId: embed.embedId,
        };
      }
      if (b.type === "social") {
        return { id: b.id, type: "social", socials: parseSocials(b.content) };
      }
      if (b.type === "email") {
        return { id: b.id, type: "email", title: b.title, href: b.url ? `mailto:${b.url}` : null };
      }
      if (b.type === "email_capture") {
        const settings = parseEmailCapture(b.content);
        return {
          id: b.id,
          type: "email_capture",
          heading: b.title || EMAIL_CAPTURE_DEFAULT_HEADING,
          buttonLabel: settings.buttonLabel || EMAIL_CAPTURE_DEFAULT_BUTTON,
          successMessage: settings.successMessage || EMAIL_CAPTURE_DEFAULT_SUCCESS,
          consentText: settings.consentText || null,
        };
      }
      return { id: b.id, type: b.type, title: b.title, content: b.content };
    })
    .filter((b): b is PublicBioBlock => b !== null);

  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    description: page.description,
    avatarUrl: page.avatarUrl,
    theme: page.theme,
    removeBranding: page.removeBranding ?? false,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    socialImageUrl: page.socialImageUrl,
    customDomain: page.customDomain,
    blocks: publicBlocks,
  };
}

export async function getPublicBioPageBySlug(
  ctx: PublicTRPCContext,
  slug: string,
): Promise<PublicBioPage | null> {
  const page = await ctx.db.query.bioPage.findFirst({
    where: and(eq(bioPage.slug, slug), eq(bioPage.isPublished, true)),
    with: { user: { columns: { deletedAt: true } } },
  });
  if (!page || page.user?.deletedAt) return null;
  return assemblePublicBioPage(ctx.db, page);
}

export async function getPublicBioPageByDomain(
  ctx: PublicTRPCContext,
  domain: string,
): Promise<PublicBioPage | null> {
  const normalized = domain
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  const page = await ctx.db.query.bioPage.findFirst({
    where: and(eq(bioPage.customDomain, normalized), eq(bioPage.isPublished, true)),
    with: { user: { columns: { deletedAt: true } } },
  });
  if (!page || page.user?.deletedAt) return null;
  return assemblePublicBioPage(ctx.db, page);
}

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

export const BIO_SUBSCRIBE_RATE_LIMIT = { limit: 10, windowSeconds: 10 * 60 };

export type SubscribeResult =
  | { ok: true }
  | { ok: false; status: 400 | 404 | 429; error: string; retryAfter?: number };

/**
 * A visitor signs up through a page's email signup block. Signing up twice is
 * a success that stores nothing new, and a filled honeypot gets the same
 * success without a write, so bots learn nothing.
 */
export async function subscribeToBioPage(
  db: PublicTRPCContext["db"],
  input: SubscribeInput,
  options: {
    ipHash: string;
    store?: CounterStore;
    defer?: (task: Promise<unknown>) => void;
    nowMs?: number;
  },
): Promise<SubscribeResult> {
  if (input.website) return { ok: true };

  const email = subscriberEmailSchema.safeParse(input.email);
  if (!email.success) {
    return {
      ok: false,
      status: 400,
      error: email.error.issues[0]?.message ?? "Enter a valid email address.",
    };
  }

  const decision = await consumeRateLimit(
    `bio-subscribe:${options.ipHash}`,
    [BIO_SUBSCRIBE_RATE_LIMIT],
    options,
  );
  if (!decision.allowed) {
    return {
      ok: false,
      status: 429,
      error: "Too many signups from your network. Try again in a few minutes.",
      retryAfter: decision.retryAfter,
    };
  }

  const [row] = await db
    .select({ block: bioBlock, isPublished: bioPage.isPublished, deletedAt: user.deletedAt })
    .from(bioBlock)
    .innerJoin(bioPage, eq(bioPage.id, bioBlock.bioPageId))
    .leftJoin(user, eq(user.id, bioPage.userId))
    .where(and(eq(bioBlock.id, input.blockId), eq(bioBlock.type, "email_capture")))
    .limit(1);
  if (!row || !row.isPublished || row.deletedAt || !isBlockLive(row.block, Date.now())) {
    return { ok: false, status: 404, error: "This signup form is no longer available." };
  }

  if (parseEmailCapture(row.block.content).consentText && !input.consent) {
    return { ok: false, status: 400, error: "Tick the box to agree before signing up." };
  }

  await db
    .insert(bioSubscriber)
    .values({ bioPageId: row.block.bioPageId, email: email.data })
    .onDuplicateKeyUpdate({ set: { id: sql`${bioSubscriber.id}` } });
  return { ok: true };
}

export async function listSubscribers(ctx: WorkspaceTRPCContext, input: ListSubscribersInput) {
  const page = await fetchBioPageForWorkspace(ctx, input.bioPageId);
  const [items, [total]] = await Promise.all([
    ctx.db
      .select({
        id: bioSubscriber.id,
        email: bioSubscriber.email,
        createdAt: bioSubscriber.createdAt,
      })
      .from(bioSubscriber)
      .where(eq(bioSubscriber.bioPageId, page.id))
      .orderBy(desc(bioSubscriber.createdAt), desc(bioSubscriber.id))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize),
    ctx.db
      .select({ count: count() })
      .from(bioSubscriber)
      .where(eq(bioSubscriber.bioPageId, page.id)),
  ]);
  return { items, total: Number(total?.count ?? 0) };
}

export async function deleteSubscriber(ctx: WorkspaceTRPCContext, id: number) {
  requirePermission(ctx.workspace, "bio.edit", "edit bio pages");
  const [row] = await ctx.db
    .select({ id: bioSubscriber.id })
    .from(bioSubscriber)
    .innerJoin(bioPage, eq(bioPage.id, bioSubscriber.bioPageId))
    .where(
      and(eq(bioSubscriber.id, id), workspaceFilter(ctx.workspace, bioPage.userId, bioPage.teamId)),
    );
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Subscriber not found." });
  await ctx.db.delete(bioSubscriber).where(eq(bioSubscriber.id, row.id));
  return { success: true };
}

/** A page's subscribers as CSV, newest first. Available on every plan. */
export async function exportSubscribers(ctx: WorkspaceTRPCContext, bioPageId: number) {
  const page = await fetchBioPageForWorkspace(ctx, bioPageId);
  const rows = await ctx.db
    .select({ email: bioSubscriber.email, createdAt: bioSubscriber.createdAt })
    .from(bioSubscriber)
    .where(eq(bioSubscriber.bioPageId, page.id))
    .orderBy(desc(bioSubscriber.createdAt), desc(bioSubscriber.id))
    // One extra row tells a list that hit the cap from one that fits exactly.
    .limit(MAX_SUBSCRIBER_EXPORT_ROWS + 1);
  const truncated = rows.length > MAX_SUBSCRIBER_EXPORT_ROWS;
  const exported = truncated ? rows.slice(0, MAX_SUBSCRIBER_EXPORT_ROWS) : rows;
  return { csv: subscribersToCsv(exported), rowCount: exported.length, truncated, slug: page.slug };
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

const RANGE_DAYS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: 3650,
} satisfies Record<"7d" | "30d" | "90d" | "all", number>;

const APP_HOST_REFERRER = baseDomain(getAppBaseDomain());

function resolveRangeDays(range: keyof typeof RANGE_DAYS, capDays?: number): number {
  const base = RANGE_DAYS[range];
  return capDays !== undefined ? Math.min(base, capDays) : base;
}

export async function getBioPageAnalytics(
  ctx: WorkspaceTRPCContext,
  input: { id: number; range: "7d" | "30d" | "90d" | "all" },
) {
  const page = await fetchBioPageForWorkspace(ctx, input.id);
  const caps = getPlanCaps(ctx.workspace.plan);
  const rangeDays = resolveRangeDays(input.range, caps.analyticsRangeLimitDays);
  const start = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  // Page views, unique views and view referrers (grouped aggregates, not row
  // loads). Referrers come from page views because link blocks open with
  // rel="noreferrer", so link clicks never carry the visitor's source.
  const viewFilter = and(eq(bioPageView.bioPageId, page.id), gte(bioPageView.createdAt, start));
  const viewDay = sql<string>`DATE_FORMAT(${bioPageView.createdAt}, '%Y-%m-%d')`;
  const [viewsAgg, uniqueAgg, viewsByDay, referrerRows] = await Promise.all([
    ctx.db.select({ count: count() }).from(bioPageView).where(viewFilter),
    ctx.db
      .select({ count: count() })
      .from(uniqueBioPageView)
      .where(
        and(eq(uniqueBioPageView.bioPageId, page.id), gte(uniqueBioPageView.createdAt, start)),
      ),
    ctx.db
      .select({ date: viewDay, count: count() })
      .from(bioPageView)
      .where(viewFilter)
      .groupBy(viewDay),
    ctx.db
      .select({ value: bioPageView.referer, count: count() })
      .from(bioPageView)
      .where(
        and(
          viewFilter,
          // Views recorded before the beacon sent document.referrer all hold the
          // app host (the beacon request's own Referer). Pages on the app host
          // now record same-host visits as direct, so this value carries no
          // source information and is left out.
          or(isNull(bioPageView.referer), ne(bioPageView.referer, APP_HOST_REFERRER)),
        ),
      )
      .groupBy(bioPageView.referer),
  ]);

  // Per-block clicks: one grouped query over all backing links for this page.
  const blocks = await ctx.db.query.bioBlock.findMany({
    where: eq(bioBlock.bioPageId, page.id),
    orderBy: (t, { asc }) => [asc(t.position)],
  });
  const linkBlocks = blocks.filter((b) => (b.type === "link" || b.type === "image") && b.linkId);
  const linkIds = linkBlocks.map((b) => b.linkId!);

  // Per-block counts plus country/device breakdowns, all grouped over the same
  // visits so every breakdown sums to totalClicks.
  const clickFilter = and(inArray(linkVisit.linkId, linkIds), gte(linkVisit.createdAt, start));
  const groupClicksBy = (column: MySqlColumn) =>
    ctx.db
      .select({ value: sql<string | null>`${column}`, count: count() })
      .from(linkVisit)
      .where(clickFilter)
      .groupBy(column);
  const [clickRows, countryRows, deviceRows] = linkIds.length
    ? await Promise.all([
        ctx.db
          .select({ linkId: linkVisit.linkId, count: count() })
          .from(linkVisit)
          .where(clickFilter)
          .groupBy(linkVisit.linkId),
        groupClicksBy(linkVisit.country),
        groupClicksBy(linkVisit.device),
      ])
    : [[], [], []];
  const clickMap = new Map(clickRows.map((r) => [r.linkId, Number(r.count)]));

  const perBlock = linkBlocks
    .map((b) => ({
      blockId: b.id,
      title:
        b.type === "image"
          ? b.title || "Image"
          : b.title || (parseWhatsApp(b.content) ? WHATSAPP_DEFAULT_LABEL : b.url) || "Link",
      clicks: clickMap.get(b.linkId!) ?? 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  const totalClicks = perBlock.reduce((sum, b) => sum + b.clicks, 0);
  const views = Number(viewsAgg[0]?.count ?? 0);
  const uniqueViews = Number(uniqueAgg[0]?.count ?? 0);

  // Zero-filled across the range so a single day of views still plots.
  const viewsPerDay: Record<string, number> = {};
  for (const row of viewsByDay) viewsPerDay[row.date] = Number(row.count);
  const viewsSeries = fillClickSeries(
    { clicksPerDate: viewsPerDay },
    { from: rangeDays === RANGE_DAYS.all ? null : start, to: new Date(), granularity: "day" },
  ).map((point) => ({ date: point.date, views: point.clicks }));

  return {
    views,
    uniqueViews,
    totalClicks,
    ctr: views > 0 ? totalClicks / views : 0,
    perBlock,
    clickBreakdowns: {
      countries: buildBreakdown(countryRows, countryLabel),
      devices: buildBreakdown(deviceRows, deviceLabel),
    },
    viewReferrers: buildBreakdown(referrerRows, referrerHostLabel),
    viewsSeries,
    rangeDays,
    isProPlan: ctx.workspace.plan !== "free",
  };
}

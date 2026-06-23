import { TRPCError } from "@trpc/server";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  canRemoveBioBranding,
  canScheduleBioBlocks,
  canUseBioCustomDomain,
  canUseBioCustomThemes,
  getPlanCaps,
} from "@/lib/billing/plans";
import { isPlatformDomain } from "@/lib/constants/domains";
import {
  bioBlock,
  bioPage,
  bioPageView,
  bioPageViewDailySummary,
  link,
  linkVisit,
  uniqueBioPageView,
} from "@/server/db/schema";
import { deleteImage, uploadImage } from "@/server/lib/storage";
import {
  deleteHiddenTrackingLink,
  insertHiddenTrackingLink,
  prepareHiddenTrackingLink,
  purgeTrackingLinkCache,
  updateHiddenTrackingLink,
} from "@/server/lib/tracking-link";
import { requirePermission, workspaceFilter, workspaceOwnership } from "@/server/lib/workspace";

import { assertDomainAllowed } from "../link/utils";
import {
  assertSlugAllowed,
  checkBioPageLimit,
  pageBelongsToWorkspace,
  rethrowBioDuplicate,
} from "./utils";

import type {
  AddBioBlockInput,
  CreateBioPageInput,
  ReorderBlocksInput,
  UpdateBioBlockInput,
  UpdateBioPageInput,
} from "./bio-page.input";
import type { PublicTRPCContext, WorkspaceTRPCContext } from "../../trpc";
import type { BioBlock, BioPageTheme, BioSocialLink } from "@/server/db/schema";
import type { ImageType } from "@/server/lib/storage/types";

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

function parseSocials(content: string | null): BioSocialLink[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as BioSocialLink[]) : [];
  } catch {
    return [];
  }
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

/**
 * Upload a new bio image (or clear it) and remove the previous R2 object when it
 * changed. deleteImage is a no-op for non-R2 (base64) values, so this is always
 * safe. Returns the value to persist.
 */
async function resolveImageUpdate(
  ctx: WorkspaceTRPCContext,
  resourceId: number,
  imageType: ImageType,
  next: string | null | undefined,
  previous: string | null,
): Promise<string | null> {
  const resolved = next
    ? (await uploadImage(ctx, { image: next, resourceId, imageType })) ?? next
    : null;
  if (previous && previous !== resolved) {
    await deleteImage(previous).catch(() => {});
  }
  return resolved;
}

async function fetchBioPageForWorkspace(ctx: WorkspaceTRPCContext, id: number) {
  const page = await ctx.db.query.bioPage.findFirst({
    where: and(
      eq(bioPage.id, id),
      workspaceFilter(ctx.workspace, bioPage.userId, bioPage.teamId),
    ),
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

function toEditorBlock(b: BioBlock, linkMap: Map<number, { domain: string; alias: string | null; blocked: boolean | null }>) {
  const base = {
    id: b.id,
    type: b.type,
    title: b.title,
    content: b.content,
    url: b.url,
    isVisible: b.isVisible,
    position: b.position,
    scheduledAt: b.scheduledAt,
    scheduledUntil: b.scheduledUntil,
    socials: b.type === "social" ? parseSocials(b.content) : undefined,
    shortUrl: null as string | null,
    blocked: false,
  };
  if (b.type === "link" && b.linkId) {
    const l = linkMap.get(b.linkId);
    base.shortUrl = l?.alias ? `https://${l.domain}/${l.alias}` : null;
    base.blocked = l?.blocked ?? false;
  }
  return base;
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
    rethrowBioDuplicate(error);
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

  if (input.removeBranding !== undefined) {
    if (input.removeBranding && !canRemoveBioBranding(plan)) {
      throw forbidden("Removing iShortn branding is available on Pro and Ultra plans.");
    }
    updates.removeBranding = input.removeBranding;
  }

  if (input.theme !== undefined) {
    if (input.theme && themeHasCustomization(input.theme) && !canUseBioCustomThemes(plan)) {
      throw forbidden("Theme customization is available on Pro and Ultra plans.");
    }
    updates.theme = input.theme ?? null;
  }

  if (input.customDomain !== undefined) {
    if (input.customDomain) {
      if (!canUseBioCustomDomain(plan)) {
        throw forbidden("Custom domains for bio pages are available on Pro and Ultra plans.");
      }
      const normalized = input.customDomain.trim().toLowerCase();
      if (isPlatformDomain(normalized)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Use a custom domain you own, not the platform domain.",
        });
      }
      await assertDomainAllowed(ctx, normalized); // must be a verified domain in this workspace
      updates.customDomain = normalized;
    } else {
      updates.customDomain = null;
    }
  }

  if (input.avatarUrl !== undefined) {
    updates.avatarUrl = await resolveImageUpdate(
      ctx,
      page.id,
      "bio-avatar",
      input.avatarUrl,
      page.avatarUrl,
    );
  }
  if (input.socialImageUrl !== undefined) {
    updates.socialImageUrl = await resolveImageUpdate(
      ctx,
      page.id,
      "bio-og",
      input.socialImageUrl,
      page.socialImageUrl,
    );
  }

  if (Object.keys(updates).length > 0) {
    try {
      await ctx.db.update(bioPage).set(updates).where(eq(bioPage.id, page.id));
    } catch (error) {
      rethrowBioDuplicate(error);
    }
  }
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
    await tx.delete(bioPage).where(eq(bioPage.id, page.id));
  });

  for (const l of backingLinks) {
    if (l.alias) purgeTrackingLinkCache(l.domain, l.alias);
  }

  // Remove the page's images from R2 (no-op for non-R2/base64 values).
  await Promise.all(
    [page.avatarUrl, page.socialImageUrl]
      .filter((url): url is string => !!url)
      .map((url) => deleteImage(url).catch(() => {})),
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
    input.type === "social" ? JSON.stringify(input.socials ?? []) : input.content ?? null;

  if (input.type === "link") {
    const destination = input.url?.trim();
    if (!destination) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A link block needs a destination URL." });
    }
    const prepared = await prepareHiddenTrackingLink(ctx, {
      url: destination,
      name: input.title || page.title || "Bio link",
      kind: "bio",
    });
    const id = await ctx.db.transaction(async (tx) => {
      const linkId = await insertHiddenTrackingLink(tx, ctx, prepared);
      const [res] = await tx.insert(bioBlock).values({
        bioPageId: page.id,
        type: "link",
        title: input.title ?? null,
        url: destination,
        linkId,
        position,
        scheduledAt: input.scheduledAt ?? null,
        scheduledUntil: input.scheduledUntil ?? null,
      });
      return Number(res.insertId);
    });
    revalidateBioPath(page.slug);
    return { id };
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
  assertSchedulingAllowed(ctx, input.scheduledAt, input.scheduledUntil);

  const updates: Partial<typeof bioBlock.$inferInsert> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.isVisible !== undefined) updates.isVisible = input.isVisible;
  if (input.scheduledAt !== undefined) updates.scheduledAt = input.scheduledAt;
  if (input.scheduledUntil !== undefined) updates.scheduledUntil = input.scheduledUntil;

  if (block.type === "social") {
    if (input.socials !== undefined) updates.content = JSON.stringify(input.socials);
  } else if (input.content !== undefined) {
    updates.content = input.content;
  }

  if (input.url !== undefined) {
    updates.url = input.url;
    if (block.type === "link" && block.linkId && input.url) {
      await updateHiddenTrackingLink(ctx, block.linkId, {
        url: input.url,
        name: input.title ?? block.title ?? undefined,
      });
    }
  }

  if (Object.keys(updates).length > 0) {
    await ctx.db.update(bioBlock).set(updates).where(eq(bioBlock.id, block.id));
  }
  revalidateBioPath(block.bioPage.slug);
  return { success: true };
}

export async function deleteBlock(ctx: WorkspaceTRPCContext, id: number) {
  const block = await fetchBlockForWorkspace(ctx, id);
  requirePermission(ctx.workspace, "bio.edit", "edit bio pages");

  if (block.type === "link" && block.linkId) {
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
  const ordered = input.blockIds.filter((id) => validIds.has(id));

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
  | { id: number; type: "email"; title: string | null; href: string | null }
  | { id: number; type: "social"; socials: BioSocialLink[] }
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
  ownerId: string;
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

  const publicBlocks: PublicBioBlock[] = live
    .map((b): PublicBioBlock | null => {
      if (b.type === "link") {
        const l = b.linkId ? linkMap.get(b.linkId) : undefined;
        // A blocked/disabled or missing backing link hides the block entirely.
        if (!l || l.blocked || l.disabled || !l.alias) return null;
        return { id: b.id, type: "link", title: b.title, href: `https://${l.domain}/${l.alias}` };
      }
      if (b.type === "social") {
        return { id: b.id, type: "social", socials: parseSocials(b.content) };
      }
      if (b.type === "email") {
        return { id: b.id, type: "email", title: b.title, href: b.url ? `mailto:${b.url}` : null };
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
    ownerId: page.userId,
    blocks: publicBlocks,
  };
}

export async function getPublicBioPageBySlug(
  ctx: PublicTRPCContext,
  slug: string,
): Promise<PublicBioPage | null> {
  const page = await ctx.db.query.bioPage.findFirst({
    where: and(eq(bioPage.slug, slug), eq(bioPage.isPublished, true)),
  });
  if (!page) return null;
  return assemblePublicBioPage(ctx.db, page);
}

export async function getPublicBioPageByDomain(
  ctx: PublicTRPCContext,
  domain: string,
): Promise<PublicBioPage | null> {
  const normalized = domain.trim().toLowerCase().replace(/^www\./, "");
  const page = await ctx.db.query.bioPage.findFirst({
    where: and(eq(bioPage.customDomain, normalized), eq(bioPage.isPublished, true)),
  });
  if (!page) return null;
  return assemblePublicBioPage(ctx.db, page);
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

const RANGE_DAYS: Record<"7d" | "30d" | "90d" | "all", number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: 3650,
};

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

  // Page views + unique views (grouped aggregates, not row loads).
  const viewFilter = and(eq(bioPageView.bioPageId, page.id), gte(bioPageView.createdAt, start));
  const [viewsAgg, uniqueAgg, viewsByDay] = await Promise.all([
    ctx.db.select({ count: count() }).from(bioPageView).where(viewFilter),
    ctx.db
      .select({ count: count() })
      .from(uniqueBioPageView)
      .where(and(eq(uniqueBioPageView.bioPageId, page.id), gte(uniqueBioPageView.createdAt, start))),
    ctx.db
      .select({
        date: sql<string>`DATE(${bioPageView.createdAt})`,
        count: count(),
      })
      .from(bioPageView)
      .where(viewFilter)
      .groupBy(sql`DATE(${bioPageView.createdAt})`),
  ]);

  // Per-block clicks: one grouped query over all backing links for this page.
  const blocks = await ctx.db.query.bioBlock.findMany({
    where: eq(bioBlock.bioPageId, page.id),
    orderBy: (t, { asc }) => [asc(t.position)],
  });
  const linkBlocks = blocks.filter((b) => b.type === "link" && b.linkId);
  const linkIds = linkBlocks.map((b) => b.linkId!);

  const clickRows = linkIds.length
    ? await ctx.db
        .select({ linkId: linkVisit.linkId, count: count() })
        .from(linkVisit)
        .where(and(inArray(linkVisit.linkId, linkIds), gte(linkVisit.createdAt, start)))
        .groupBy(linkVisit.linkId)
    : [];
  const clickMap = new Map(clickRows.map((r) => [r.linkId, Number(r.count)]));

  const perBlock = linkBlocks
    .map((b) => ({
      blockId: b.id,
      title: b.title || b.url || "Link",
      clicks: clickMap.get(b.linkId!) ?? 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  const totalClicks = perBlock.reduce((sum, b) => sum + b.clicks, 0);
  const views = Number(viewsAgg[0]?.count ?? 0);
  const uniqueViews = Number(uniqueAgg[0]?.count ?? 0);

  const viewsPerDay: Record<string, number> = {};
  for (const row of viewsByDay) viewsPerDay[row.date] = Number(row.count);

  return {
    views,
    uniqueViews,
    totalClicks,
    ctr: views > 0 ? totalClicks / views : 0,
    perBlock,
    viewsPerDay,
    rangeDays,
    isProPlan: ctx.workspace.plan !== "free",
  };
}

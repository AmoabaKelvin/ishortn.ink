import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { buildCacheKey, deleteFromCache } from "@/lib/core/cache";
import { generateShortLink } from "@/lib/core/links";
import { runBackgroundTask } from "@/lib/utils/background";
import { link, linkVisit, uniqueLinkVisit, user } from "@/server/db/schema";
import { assertUrlSafe } from "@/server/lib/phishing";
import { workspaceFilter, workspaceOwnership } from "@/server/lib/workspace";

import {
  assertDomainAllowed,
  checkWorkspaceLinkLimit,
  getWorkspaceDefaultDomain,
} from "@/server/api/routers/link/utils";

import type { WorkspaceTRPCContext } from "@/server/api/trpc";
import type { db } from "@/server/db";

// A "hidden tracking link" is a regular Link row that backs another resource
// (a QR code, or a bio-page link block) rather than appearing in the user's
// main link list. Clicks on it flow through the normal redirect + analytics
// pipeline, so the backing resource gets click tracking for free. This module
// is the single place that creates/updates/deletes them so QR and bio pages
// stay consistent (quota accounting, cache invalidation, ownership).

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type TrackingLinkKind = "qr" | "bio";

export type PreparedTrackingLink = {
  values: typeof link.$inferInsert;
  trackingUrl: string;
  alias: string;
  domain: string;
  shouldIncrementCount: boolean;
  currentCount: number;
};

/**
 * Validate + resolve everything needed to create a hidden tracking link before
 * a transaction is opened: the link-quota check, URL safety scan, domain
 * authorization, and alias generation. Throws TRPCError("FORBIDDEN") when the
 * workspace's monthly link quota is reached.
 */
export async function prepareHiddenTrackingLink(
  ctx: WorkspaceTRPCContext,
  opts: { url: string; name: string; domain?: string; kind: TrackingLinkKind },
): Promise<PreparedTrackingLink> {
  const { currentCount, limit } = await checkWorkspaceLinkLimit(ctx);

  await assertUrlSafe(opts.url);

  const requestedDomain = opts.domain?.trim();
  if (requestedDomain) {
    await assertDomainAllowed(ctx, requestedDomain);
  }

  const [alias, domain] = await Promise.all([
    generateShortLink(),
    requestedDomain ? Promise.resolve(requestedDomain) : getWorkspaceDefaultDomain(ctx),
  ]);

  const ownership = workspaceOwnership(ctx.workspace);
  const shouldIncrementCount = ctx.workspace.type !== "team" && limit !== undefined;

  return {
    values: {
      url: opts.url,
      alias,
      domain,
      name: opts.name,
      isQrCode: opts.kind === "qr",
      isBioLink: opts.kind === "bio",
      userId: ownership.userId ?? ctx.auth.userId,
      teamId: ownership.teamId,
      createdByUserId: ctx.auth.userId,
    },
    trackingUrl: `https://${domain}/${alias}`,
    alias,
    domain,
    shouldIncrementCount,
    currentCount,
  };
}

/**
 * Insert a prepared hidden tracking link inside an existing transaction and
 * bump the workspace's monthly link count in the same transaction, so a
 * downstream failure rolls the link and the count back together (no orphan
 * links, no quota drift). Returns the new link id.
 */
export async function insertHiddenTrackingLink(
  tx: TransactionClient,
  ctx: WorkspaceTRPCContext,
  prepared: PreparedTrackingLink,
): Promise<number> {
  const result = await tx.insert(link).values(prepared.values);
  const linkId = Number(result[0].insertId);

  if (prepared.shouldIncrementCount) {
    await tx
      .update(user)
      .set({ monthlyLinkCount: prepared.currentCount + 1 })
      .where(eq(user.id, ctx.auth.userId));
  }

  return linkId;
}

/**
 * Update a hidden tracking link's destination/name and invalidate its Redis
 * cache entry so the change takes effect on the next redirect. Verifies the
 * link belongs to the caller's workspace.
 */
export async function updateHiddenTrackingLink(
  ctx: WorkspaceTRPCContext,
  linkId: number,
  opts: { url?: string; name?: string },
): Promise<void> {
  if (opts.url !== undefined) {
    await assertUrlSafe(opts.url);
  }

  const existing = await ctx.db.query.link.findFirst({
    where: and(
      eq(link.id, linkId),
      workspaceFilter(ctx.workspace, link.userId, link.teamId),
    ),
  });

  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tracking link not found." });
  }

  const updates: Partial<typeof link.$inferInsert> = {};
  if (opts.url !== undefined) updates.url = opts.url;
  if (opts.name !== undefined) updates.name = opts.name;

  if (Object.keys(updates).length > 0) {
    await ctx.db.update(link).set(updates).where(eq(link.id, linkId));
  }

  if (existing.alias) {
    await deleteFromCache(buildCacheKey(existing.domain, existing.alias));
  }
}

/**
 * Delete a hidden tracking link and its visit rows inside an existing
 * transaction. The caller invalidates the Redis cache after the transaction
 * commits (use purgeTrackingLinkCache with the link's domain + alias).
 */
export async function deleteHiddenTrackingLink(
  tx: TransactionClient,
  linkId: number,
): Promise<void> {
  await Promise.all([
    tx.delete(uniqueLinkVisit).where(eq(uniqueLinkVisit.linkId, linkId)),
    tx.delete(linkVisit).where(eq(linkVisit.linkId, linkId)),
  ]);
  await tx.delete(link).where(eq(link.id, linkId));
}

/** Invalidate the redirect cache for a tracking link's domain/alias. */
export function purgeTrackingLinkCache(domain: string, alias: string): void {
  void runBackgroundTask(deleteFromCache(buildCacheKey(domain, alias)));
}

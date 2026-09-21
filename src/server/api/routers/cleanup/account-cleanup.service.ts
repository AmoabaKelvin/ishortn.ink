import { clerkClient } from "@clerk/nextjs/server";
import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { DELETION_GRACE_PERIOD_DAYS, purgeDateFor } from "@/lib/account-deletion/constants";
import { buildCacheKey, deleteFromCache } from "@/lib/core/cache";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import {
  accountDeletion,
  accountTransfer,
  audienceFeedback,
  bioBlock,
  bioPage,
  bioPageView,
  bioPageViewDailySummary,
  campaign,
  customDomain,
  feedback,
  flaggedLink,
  folder,
  folderPermission,
  geoRule,
  link,
  linkMilestone,
  linkTag,
  linkVisit,
  linkVisitDailySummary,
  qrcode,
  qrPreset,
  siteSettings,
  subscription,
  tag,
  teamMember,
  token,
  uniqueBioPageView,
  uniqueLinkVisit,
  user,
  utmTemplate,
} from "@/server/db/schema";

import { deleteCustomHostname } from "../domains/cloudflare";

const log = logger.child({ job: "cleanup-accounts" });

// ponytail: IN-list chunk, keeps a 50k-link account from building one giant
// statement. Raise it if the purge ever becomes the slow part.
function chunk<T>(items: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface AccountCleanupResult {
  accountsDeleted: number;
  linksDeleted: number;
  bioPagesDeleted: number;
  failures: number;
}

/**
 * Permanently delete accounts that were soft-deleted more than the grace period
 * ago. Mirrors cleanupDeletedTeams, but scoped to a user's personal resources —
 * team-owned rows are never touched (a user who owns a team can't get here;
 * deletion is blocked until the team is handled).
 *
 * The AccountDeletion survey row is deliberately kept: it is the churn data the
 * whole flow exists to collect.
 */
export async function cleanupDeletedAccounts(): Promise<AccountCleanupResult> {
  const result: AccountCleanupResult = {
    accountsDeleted: 0,
    linksDeleted: 0,
    bioPagesDeleted: 0,
    failures: 0,
  };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DELETION_GRACE_PERIOD_DAYS);

  const usersToDelete = await db.query.user.findMany({
    where: and(isNotNull(user.deletedAt), lt(user.deletedAt, cutoffDate)),
    columns: { id: true, email: true },
  });

  for (const record of usersToDelete) {
    try {
      if (await purgeAccount(record.id, result)) result.accountsDeleted += 1;
    } catch (err) {
      result.failures += 1;
      log.error({ err, userId: record.id }, "failed to purge account; will retry next run");
    }
  }

  return result;
}

async function purgeAccount(userId: string, result: AccountCleanupResult): Promise<boolean> {
  // The candidate list is a snapshot; earlier purges in this run take time.
  // Re-read so an account restored since then is never destroyed. Same deadline
  // restoreAccount enforces, so the two can't overlap.
  const current = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { deletedAt: true },
  });

  if (!current?.deletedAt || purgeDateFor(current.deletedAt) > new Date()) {
    log.info({ userId }, "account no longer eligible for purge; skipping");
    return false;
  }

  // Personal resources only: teamId IS NULL. Team-owned rows stay put.
  const [links, bioPages, domains, folders] = await Promise.all([
    db
      .select({ id: link.id, alias: link.alias, domain: link.domain })
      .from(link)
      .where(and(eq(link.userId, userId), isNull(link.teamId))),
    db
      .select({ id: bioPage.id })
      .from(bioPage)
      .where(and(eq(bioPage.userId, userId), isNull(bioPage.teamId))),
    db
      .select({ domain: customDomain.domain })
      .from(customDomain)
      .where(and(eq(customDomain.userId, userId), isNull(customDomain.teamId))),
    db
      .select({ id: folder.id })
      .from(folder)
      .where(and(eq(folder.userId, userId), isNull(folder.teamId))),
  ]);

  // Identity first: once Clerk is gone the user can't sign back in mid-purge.
  // A failure here aborts before any row is touched, so the next run retries.
  try {
    await (await clerkClient()).users.deleteUser(userId);
  } catch (err) {
    // SAFETY: Clerk's backend SDK throws errors carrying a numeric `status`;
    // reading it off an unknown shape yields undefined, which we rethrow. A 404
    // means the identity is already gone, which is not a failure.
    const status = (err as { status?: number }).status;
    if (status !== 404) throw err;
  }

  // Before the rows go: once customDomain is deleted nothing can rediscover the
  // hostname, so a Cloudflare failure aborts here and the next run retries.
  // Already-removed hostnames are a no-op.
  await Promise.all(domains.map((d) => (d.domain ? deleteCustomHostname(d.domain) : undefined)));

  const linkIds = links.map((l) => l.id);
  const bioPageIds = bioPages.map((p) => p.id);
  const folderIds = folders.map((f) => f.id);

  await db.transaction(async (tx) => {
    for (const ids of chunk(linkIds)) {
      await tx.delete(linkVisit).where(inArray(linkVisit.linkId, ids));
      await tx.delete(uniqueLinkVisit).where(inArray(uniqueLinkVisit.linkId, ids));
      await tx.delete(linkVisitDailySummary).where(inArray(linkVisitDailySummary.linkId, ids));
      await tx.delete(linkTag).where(inArray(linkTag.linkId, ids));
      await tx.delete(linkMilestone).where(inArray(linkMilestone.linkId, ids));
      await tx.delete(geoRule).where(inArray(geoRule.linkId, ids));
      await tx.delete(flaggedLink).where(inArray(flaggedLink.linkId, ids));
    }

    for (const ids of chunk(bioPageIds)) {
      await tx.delete(bioBlock).where(inArray(bioBlock.bioPageId, ids));
      await tx.delete(bioPageView).where(inArray(bioPageView.bioPageId, ids));
      await tx.delete(uniqueBioPageView).where(inArray(uniqueBioPageView.bioPageId, ids));
      await tx
        .delete(bioPageViewDailySummary)
        .where(inArray(bioPageViewDailySummary.bioPageId, ids));
    }

    for (const ids of chunk(folderIds)) {
      await tx.delete(folderPermission).where(inArray(folderPermission.folderId, ids));
    }

    const deletedLinks = await tx
      .delete(link)
      .where(and(eq(link.userId, userId), isNull(link.teamId)));
    result.linksDeleted += deletedLinks[0].affectedRows;

    const deletedBioPages = await tx
      .delete(bioPage)
      .where(and(eq(bioPage.userId, userId), isNull(bioPage.teamId)));
    result.bioPagesDeleted += deletedBioPages[0].affectedRows;

    await tx.delete(qrcode).where(and(eq(qrcode.userId, userId), isNull(qrcode.teamId)));
    await tx.delete(qrPreset).where(and(eq(qrPreset.userId, userId), isNull(qrPreset.teamId)));
    await tx.delete(folder).where(and(eq(folder.userId, userId), isNull(folder.teamId)));
    await tx.delete(folderPermission).where(eq(folderPermission.userId, userId));
    await tx.delete(tag).where(and(eq(tag.userId, userId), isNull(tag.teamId)));
    await tx
      .delete(utmTemplate)
      .where(and(eq(utmTemplate.userId, userId), isNull(utmTemplate.teamId)));
    await tx.delete(campaign).where(and(eq(campaign.userId, userId), isNull(campaign.teamId)));
    await tx
      .delete(customDomain)
      .where(and(eq(customDomain.userId, userId), isNull(customDomain.teamId)));
    await tx
      .delete(siteSettings)
      .where(and(eq(siteSettings.userId, userId), isNull(siteSettings.teamId)));
    await tx.delete(token).where(eq(token.userId, userId));
    await tx.delete(subscription).where(eq(subscription.userId, userId));
    await tx.delete(audienceFeedback).where(eq(audienceFeedback.userId, userId));
    await tx.delete(feedback).where(eq(feedback.userId, userId));
    await tx.delete(teamMember).where(eq(teamMember.userId, userId));
    await tx
      .delete(accountTransfer)
      .where(or(eq(accountTransfer.fromUserId, userId), eq(accountTransfer.toUserId, userId)));

    await tx.delete(user).where(eq(user.id, userId));

    // Survey row survives the user — stamp it so we know the purge ran.
    await tx
      .update(accountDeletion)
      .set({ purgedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(accountDeletion.userId, userId));
  });

  // Best effort: these links were blocked at deletion, so a stale key only
  // serves the blocked page until the cache TTL.
  await Promise.allSettled(links.map((l) => deleteFromCache(buildCacheKey(l.domain, l.alias!))));

  log.info({ userId, links: linkIds.length, bioPages: bioPageIds.length }, "account purged");
  return true;
}

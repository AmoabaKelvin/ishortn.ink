import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  accountTransfer,
  customDomain,
  folder,
  link,
  linkTag,
  linkVisit,
  qrcode,
  qrPreset,
  siteSettings,
  tag,
  token,
  uniqueLinkVisit,
  user,
  utmTemplate,
} from "@/server/db/schema";

// Grace period in days before permanently deleting soft-deleted accounts
const GRACE_PERIOD_DAYS = 30;

interface CleanupResult {
  accountsDeleted: number;
  linksDeleted: number;
  linkVisitsDeleted: number;
  uniqueLinkVisitsDeleted: number;
  foldersDeleted: number;
  qrCodesDeleted: number;
  qrPresetsDeleted: number;
  tagsDeleted: number;
  linkTagsDeleted: number;
  customDomainsDeleted: number;
  utmTemplatesDeleted: number;
  siteSettingsDeleted: number;
  tokensDeleted: number;
  transfersDeleted: number;
}

/**
 * Clean up soft-deleted accounts that have passed the grace period.
 * This permanently deletes the account and all associated personal workspace resources.
 *
 * Note: Team memberships are handled separately.
 * Subscriptions are preserved for billing history.
 *
 * Should be called by a cron job with API key authentication.
 */
export async function cleanupDeletedAccounts(): Promise<CleanupResult> {
  const result: CleanupResult = {
    accountsDeleted: 0,
    linksDeleted: 0,
    linkVisitsDeleted: 0,
    uniqueLinkVisitsDeleted: 0,
    foldersDeleted: 0,
    qrCodesDeleted: 0,
    qrPresetsDeleted: 0,
    tagsDeleted: 0,
    linkTagsDeleted: 0,
    customDomainsDeleted: 0,
    utmTemplatesDeleted: 0,
    siteSettingsDeleted: 0,
    tokensDeleted: 0,
    transfersDeleted: 0,
  };

  // Calculate the cutoff date (accounts deleted before this date should be cleaned up)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - GRACE_PERIOD_DAYS);

  // Find all accounts that are soft-deleted and past the grace period
  const accountsToDelete = await db.query.user.findMany({
    where: and(isNotNull(user.deletedAt), lt(user.deletedAt, cutoffDate)),
    columns: {
      id: true,
      name: true,
      email: true,
      deletedAt: true,
    },
  });

  if (accountsToDelete.length === 0) {
    return result;
  }

  console.log(
    `[Account Cleanup] Found ${accountsToDelete.length} accounts to delete`
  );

  // Process each account
  for (const userAccount of accountsToDelete) {
    const userId = userAccount.id;

    console.log(
      `[Account Cleanup] Processing account: ${userAccount.email} (${userId})`
    );

    try {
      // Use a transaction to ensure atomic deletion of all resources
      await db.transaction(async (tx) => {
        // 1. Get all personal workspace links to delete their related records
        const userLinks = await tx
          .select({ id: link.id })
          .from(link)
          .where(and(eq(link.userId, userId), isNull(link.teamId)));

        const linkIds = userLinks.map((l) => l.id);

        if (linkIds.length > 0) {
          // Delete link visits
          const linkVisitResult = await tx
            .delete(linkVisit)
            .where(
              sql`${linkVisit.linkId} IN (${sql.join(
                linkIds.map((id) => sql`${id}`),
                sql`, `
              )})`
            );
          result.linkVisitsDeleted += linkVisitResult[0].affectedRows;

          // Delete unique link visits
          const uniqueVisitResult = await tx
            .delete(uniqueLinkVisit)
            .where(
              sql`${uniqueLinkVisit.linkId} IN (${sql.join(
                linkIds.map((id) => sql`${id}`),
                sql`, `
              )})`
            );
          result.uniqueLinkVisitsDeleted += uniqueVisitResult[0].affectedRows;

          // Delete link-tag associations
          const linkTagResult = await tx
            .delete(linkTag)
            .where(
              sql`${linkTag.linkId} IN (${sql.join(
                linkIds.map((id) => sql`${id}`),
                sql`, `
              )})`
            );
          result.linkTagsDeleted += linkTagResult[0].affectedRows;
        }

        // 2. Delete all personal workspace links
        const linksResult = await tx
          .delete(link)
          .where(and(eq(link.userId, userId), isNull(link.teamId)));
        result.linksDeleted += linksResult[0].affectedRows;

        // 3. Delete all personal workspace folders
        const foldersResult = await tx
          .delete(folder)
          .where(and(eq(folder.userId, userId), isNull(folder.teamId)));
        result.foldersDeleted += foldersResult[0].affectedRows;

        // 4. Delete all personal workspace QR codes
        const qrCodesResult = await tx
          .delete(qrcode)
          .where(and(eq(qrcode.userId, userId), isNull(qrcode.teamId)));
        result.qrCodesDeleted += qrCodesResult[0].affectedRows;

        // 5. Delete all personal workspace QR presets
        const qrPresetsResult = await tx
          .delete(qrPreset)
          .where(and(eq(qrPreset.userId, userId), isNull(qrPreset.teamId)));
        result.qrPresetsDeleted += qrPresetsResult[0].affectedRows;

        // 6. Delete all personal workspace tags
        const tagsResult = await tx
          .delete(tag)
          .where(and(eq(tag.userId, userId), isNull(tag.teamId)));
        result.tagsDeleted += tagsResult[0].affectedRows;

        // 7. Delete all personal workspace custom domains
        const domainsResult = await tx
          .delete(customDomain)
          .where(and(eq(customDomain.userId, userId), isNull(customDomain.teamId)));
        result.customDomainsDeleted += domainsResult[0].affectedRows;

        // 8. Delete all personal workspace UTM templates
        const utmResult = await tx
          .delete(utmTemplate)
          .where(and(eq(utmTemplate.userId, userId), isNull(utmTemplate.teamId)));
        result.utmTemplatesDeleted += utmResult[0].affectedRows;

        // 9. Delete personal workspace site settings
        const settingsResult = await tx
          .delete(siteSettings)
          .where(and(eq(siteSettings.userId, userId), isNull(siteSettings.teamId)));
        result.siteSettingsDeleted += settingsResult[0].affectedRows;

        // 10. Delete API tokens
        const tokensResult = await tx
          .delete(token)
          .where(eq(token.userId, userId));
        result.tokensDeleted += tokensResult[0].affectedRows;

        // 11. Delete account transfers (where user is source or target)
        const transfersResult = await tx
          .delete(accountTransfer)
          .where(
            sql`${accountTransfer.fromUserId} = ${userId} OR ${accountTransfer.toUserId} = ${userId}`
          );
        result.transfersDeleted += transfersResult[0].affectedRows;

        // 12. Finally, delete the user account itself
        // Note: Subscriptions are NOT deleted (may need for billing history)
        // Note: Team memberships should be handled separately
        await tx.delete(user).where(eq(user.id, userId));
        result.accountsDeleted += 1;
      });

      console.log(
        `[Account Cleanup] Successfully deleted account: ${userAccount.email}`
      );
    } catch (error) {
      console.error(
        `[Account Cleanup] Failed to delete account ${userAccount.email}:`,
        error
      );
      // Continue with other accounts
    }
  }

  return result;
}

/**
 * Get stats about accounts pending cleanup (for monitoring)
 */
export async function getCleanupStats() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - GRACE_PERIOD_DAYS);

  // Accounts ready for cleanup (past grace period)
  const readyForCleanup = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(and(isNotNull(user.deletedAt), lt(user.deletedAt, cutoffDate)));

  // Accounts in grace period (deleted but not yet ready for cleanup)
  const inGracePeriod = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(
      and(
        isNotNull(user.deletedAt),
        sql`${user.deletedAt} >= ${cutoffDate}`
      )
    );

  // Active accounts
  const activeAccounts = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .where(isNull(user.deletedAt));

  return {
    readyForCleanup: Number(readyForCleanup[0]?.count ?? 0),
    inGracePeriod: Number(inGracePeriod[0]?.count ?? 0),
    activeAccounts: Number(activeAccounts[0]?.count ?? 0),
    gracePeriodDays: GRACE_PERIOD_DAYS,
  };
}

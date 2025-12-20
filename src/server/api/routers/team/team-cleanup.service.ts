import { and, eq, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  customDomain,
  folder,
  link,
  linkTag,
  linkVisit,
  qrcode,
  siteSettings,
  tag,
  team,
  uniqueLinkVisit,
  utmTemplate,
} from "@/server/db/schema";

// Grace period in days before permanently deleting soft-deleted teams
const GRACE_PERIOD_DAYS = 30;

interface CleanupResult {
  teamsDeleted: number;
  linksDeleted: number;
  linkVisitsDeleted: number;
  uniqueLinkVisitsDeleted: number;
  foldersDeleted: number;
  qrCodesDeleted: number;
  tagsDeleted: number;
  linkTagsDeleted: number;
  customDomainsDeleted: number;
  utmTemplatesDeleted: number;
  siteSettingsDeleted: number;
}

/**
 * Clean up soft-deleted teams that have passed the grace period.
 * This permanently deletes the team and all associated resources.
 *
 * Should be called by a cron job with API key authentication.
 */
export async function cleanupDeletedTeams(): Promise<CleanupResult> {
  const result: CleanupResult = {
    teamsDeleted: 0,
    linksDeleted: 0,
    linkVisitsDeleted: 0,
    uniqueLinkVisitsDeleted: 0,
    foldersDeleted: 0,
    qrCodesDeleted: 0,
    tagsDeleted: 0,
    linkTagsDeleted: 0,
    customDomainsDeleted: 0,
    utmTemplatesDeleted: 0,
    siteSettingsDeleted: 0,
  };

  // Calculate the cutoff date (teams deleted before this date should be cleaned up)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - GRACE_PERIOD_DAYS);

  // Find all teams that are soft-deleted and past the grace period
  const teamsToDelete = await db.query.team.findMany({
    where: and(isNotNull(team.deletedAt), lt(team.deletedAt, cutoffDate)),
    columns: {
      id: true,
      name: true,
      slug: true,
      deletedAt: true,
    },
  });

  if (teamsToDelete.length === 0) {
    return result;
  }

  // Process each team
  for (const teamRecord of teamsToDelete) {
    const teamId = teamRecord.id;

    // Use a transaction to ensure atomic deletion of all resources
    await db.transaction(async (tx) => {
      // 1. Get all links for this team to delete their related records
      const teamLinks = await tx
        .select({ id: link.id })
        .from(link)
        .where(eq(link.teamId, teamId));

      const linkIds = teamLinks.map((l) => l.id);

      if (linkIds.length > 0) {
        // Delete link visits
        const linkVisitResult = await tx
          .delete(linkVisit)
          .where(sql`${linkVisit.linkId} IN (${sql.join(linkIds.map(id => sql`${id}`), sql`, `)})`);
        result.linkVisitsDeleted += linkVisitResult[0].affectedRows;

        // Delete unique link visits
        const uniqueVisitResult = await tx
          .delete(uniqueLinkVisit)
          .where(sql`${uniqueLinkVisit.linkId} IN (${sql.join(linkIds.map(id => sql`${id}`), sql`, `)})`);
        result.uniqueLinkVisitsDeleted += uniqueVisitResult[0].affectedRows;

        // Delete link-tag associations
        const linkTagResult = await tx
          .delete(linkTag)
          .where(sql`${linkTag.linkId} IN (${sql.join(linkIds.map(id => sql`${id}`), sql`, `)})`);
        result.linkTagsDeleted += linkTagResult[0].affectedRows;
      }

      // 2. Delete all links
      const linksResult = await tx.delete(link).where(eq(link.teamId, teamId));
      result.linksDeleted += linksResult[0].affectedRows;

      // 3. Delete all folders
      const foldersResult = await tx
        .delete(folder)
        .where(eq(folder.teamId, teamId));
      result.foldersDeleted += foldersResult[0].affectedRows;

      // 4. Delete all QR codes
      const qrCodesResult = await tx
        .delete(qrcode)
        .where(eq(qrcode.teamId, teamId));
      result.qrCodesDeleted += qrCodesResult[0].affectedRows;

      // 5. Delete all tags
      const tagsResult = await tx.delete(tag).where(eq(tag.teamId, teamId));
      result.tagsDeleted += tagsResult[0].affectedRows;

      // 6. Delete all custom domains
      const domainsResult = await tx
        .delete(customDomain)
        .where(eq(customDomain.teamId, teamId));
      result.customDomainsDeleted += domainsResult[0].affectedRows;

      // 7. Delete all UTM templates
      const utmResult = await tx
        .delete(utmTemplate)
        .where(eq(utmTemplate.teamId, teamId));
      result.utmTemplatesDeleted += utmResult[0].affectedRows;

      // 8. Delete site settings
      const settingsResult = await tx
        .delete(siteSettings)
        .where(eq(siteSettings.teamId, teamId));
      result.siteSettingsDeleted += settingsResult[0].affectedRows;

      // 9. Finally, delete the team itself
      await tx.delete(team).where(eq(team.id, teamId));
      result.teamsDeleted += 1;
    });
  }

  return result;
}

/**
 * Get stats about teams pending cleanup (for monitoring)
 */
export async function getCleanupStats() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - GRACE_PERIOD_DAYS);

  // Teams ready for cleanup (past grace period)
  const readyForCleanup = await db
    .select({ count: sql<number>`count(*)` })
    .from(team)
    .where(and(isNotNull(team.deletedAt), lt(team.deletedAt, cutoffDate)));

  // Teams in grace period (deleted but not yet ready for cleanup)
  const inGracePeriod = await db
    .select({ count: sql<number>`count(*)` })
    .from(team)
    .where(
      and(
        isNotNull(team.deletedAt),
        sql`${team.deletedAt} >= ${cutoffDate}`
      )
    );

  // Active teams
  const activeTeams = await db
    .select({ count: sql<number>`count(*)` })
    .from(team)
    .where(sql`${team.deletedAt} IS NULL`);

  return {
    readyForCleanup: Number(readyForCleanup[0]?.count ?? 0),
    inGracePeriod: Number(inGracePeriod[0]?.count ?? 0),
    activeTeams: Number(activeTeams[0]?.count ?? 0),
    gracePeriodDays: GRACE_PERIOD_DAYS,
  };
}

import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  link,
  linkVisit,
  subscription,
  uniqueLinkVisit,
} from "@/server/db/schema";

// Retention periods in days
const FREE_RETENTION_DAYS = 30;
const PRO_RETENTION_DAYS = 365; // 1 year

interface AnalyticsCleanupResult {
  linkVisitsDeleted: number;
  uniqueLinkVisitsDeleted: number;
  freeUsersProcessed: number;
  proUsersProcessed: number;
}

/**
 * Clean up old analytics data based on user subscription plan.
 * - Free users: Delete LinkVisit and UniqueLinkVisit records older than 30 days
 * - Pro users: Delete LinkVisit and UniqueLinkVisit records older than 1 year
 * - Ultra users: No cleanup (unlimited retention)
 *
 * Should be called by a weekly cron job.
 */
export async function cleanupAnalyticsData(): Promise<AnalyticsCleanupResult> {
  const result: AnalyticsCleanupResult = {
    linkVisitsDeleted: 0,
    uniqueLinkVisitsDeleted: 0,
    freeUsersProcessed: 0,
    proUsersProcessed: 0,
  };

  // Calculate cutoff dates
  const freeCutoffDate = new Date();
  freeCutoffDate.setDate(freeCutoffDate.getDate() - FREE_RETENTION_DAYS);

  const proCutoffDate = new Date();
  proCutoffDate.setDate(proCutoffDate.getDate() - PRO_RETENTION_DAYS);

  // Process free users (users without active subscription or with free plan)
  // A user is free if they don't have an entry in subscription table,
  // or their subscription status is not 'active', or their plan is 'free'
  const freeUserLinks = await db
    .select({ linkId: link.id })
    .from(link)
    .leftJoin(subscription, eq(link.userId, subscription.userId))
    .where(
      and(
        sql`${link.teamId} IS NULL`, // Only personal workspace links (team links handled separately)
        sql`(${subscription.id} IS NULL OR ${subscription.status} != 'active' OR ${subscription.plan} = 'free')`
      )
    );

  const freeLinkIds = freeUserLinks.map((l) => l.linkId);

  if (freeLinkIds.length > 0) {
    // Delete old link visits for free users in batches
    const batchSize = 1000;
    for (let i = 0; i < freeLinkIds.length; i += batchSize) {
      const batch = freeLinkIds.slice(i, i + batchSize);

      // Delete LinkVisit records
      const linkVisitResult = await db
        .delete(linkVisit)
        .where(
          and(
            inArray(linkVisit.linkId, batch),
            lt(linkVisit.createdAt, freeCutoffDate)
          )
        );
      result.linkVisitsDeleted += linkVisitResult[0].affectedRows;

      // Delete UniqueLinkVisit records
      const uniqueVisitResult = await db
        .delete(uniqueLinkVisit)
        .where(
          and(
            inArray(uniqueLinkVisit.linkId, batch),
            lt(uniqueLinkVisit.createdAt, freeCutoffDate)
          )
        );
      result.uniqueLinkVisitsDeleted += uniqueVisitResult[0].affectedRows;
    }
    result.freeUsersProcessed = new Set(freeUserLinks.map((l) => l.linkId)).size;
  }

  // Process pro users (active subscription with pro plan)
  const proUserLinks = await db
    .select({ linkId: link.id })
    .from(link)
    .innerJoin(subscription, eq(link.userId, subscription.userId))
    .where(
      and(
        sql`${link.teamId} IS NULL`, // Only personal workspace links
        eq(subscription.status, "active"),
        eq(subscription.plan, "pro")
      )
    );

  const proLinkIds = proUserLinks.map((l) => l.linkId);

  if (proLinkIds.length > 0) {
    const batchSize = 1000;
    for (let i = 0; i < proLinkIds.length; i += batchSize) {
      const batch = proLinkIds.slice(i, i + batchSize);

      // Delete LinkVisit records
      const linkVisitResult = await db
        .delete(linkVisit)
        .where(
          and(
            inArray(linkVisit.linkId, batch),
            lt(linkVisit.createdAt, proCutoffDate)
          )
        );
      result.linkVisitsDeleted += linkVisitResult[0].affectedRows;

      // Delete UniqueLinkVisit records
      const uniqueVisitResult = await db
        .delete(uniqueLinkVisit)
        .where(
          and(
            inArray(uniqueLinkVisit.linkId, batch),
            lt(uniqueLinkVisit.createdAt, proCutoffDate)
          )
        );
      result.uniqueLinkVisitsDeleted += uniqueVisitResult[0].affectedRows;
    }
    result.proUsersProcessed = new Set(proUserLinks.map((l) => l.linkId)).size;
  }

  // Note: Ultra users have unlimited retention, so no cleanup for them
  // Note: Team links inherit from team owner's plan - for simplicity, we skip team links here
  // Team analytics cleanup could be added as a separate feature if needed

  return result;
}

/**
 * Get stats about analytics data pending cleanup (for monitoring)
 */
export async function getAnalyticsCleanupStats() {
  const freeCutoffDate = new Date();
  freeCutoffDate.setDate(freeCutoffDate.getDate() - FREE_RETENTION_DAYS);

  const proCutoffDate = new Date();
  proCutoffDate.setDate(proCutoffDate.getDate() - PRO_RETENTION_DAYS);

  // Count total LinkVisit records older than free cutoff
  const oldFreeVisits = await db
    .select({ count: sql<number>`count(*)` })
    .from(linkVisit)
    .where(lt(linkVisit.createdAt, freeCutoffDate));

  // Count total LinkVisit records older than pro cutoff
  const oldProVisits = await db
    .select({ count: sql<number>`count(*)` })
    .from(linkVisit)
    .where(lt(linkVisit.createdAt, proCutoffDate));

  return {
    visitsOlderThan30Days: Number(oldFreeVisits[0]?.count ?? 0),
    visitsOlderThan1Year: Number(oldProVisits[0]?.count ?? 0),
    freeRetentionDays: FREE_RETENTION_DAYS,
    proRetentionDays: PRO_RETENTION_DAYS,
  };
}

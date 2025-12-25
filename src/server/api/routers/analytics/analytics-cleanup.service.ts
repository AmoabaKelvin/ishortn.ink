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

// Batch size for paginated queries and deletes
const QUERY_BATCH_SIZE = 5000;
const DELETE_BATCH_SIZE = 1000;

/**
 * Clean up old analytics data based on user subscription plan.
 * - Free users: Delete LinkVisit and UniqueLinkVisit records older than 30 days
 * - Pro users: Delete LinkVisit and UniqueLinkVisit records older than 1 year
 * - Ultra users: No cleanup (unlimited retention)
 *
 * Uses cursor-based pagination to avoid memory issues with large datasets.
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

  // Process free users with cursor-based pagination
  // A user is free if they don't have an entry in subscription table,
  // or their subscription status is not 'active', or their plan is 'free'
  let lastFreeId = 0;
  let hasMoreFree = true;

  while (hasMoreFree) {
    const freeUserLinks = await db
      .select({ linkId: link.id })
      .from(link)
      .leftJoin(subscription, eq(link.userId, subscription.userId))
      .where(
        and(
          sql`${link.id} > ${lastFreeId}`,
          sql`${link.teamId} IS NULL`, // Only personal workspace links
          sql`(${subscription.id} IS NULL OR ${subscription.status} != 'active' OR ${subscription.plan} = 'free')`
        )
      )
      .orderBy(link.id)
      .limit(QUERY_BATCH_SIZE);

    if (freeUserLinks.length === 0) {
      hasMoreFree = false;
      break;
    }

    const freeLinkIds = freeUserLinks.map((l) => l.linkId);
    lastFreeId = freeLinkIds[freeLinkIds.length - 1] ?? lastFreeId;
    result.freeUsersProcessed += freeLinkIds.length;

    // Delete old link visits for free users in batches
    for (let i = 0; i < freeLinkIds.length; i += DELETE_BATCH_SIZE) {
      const batch = freeLinkIds.slice(i, i + DELETE_BATCH_SIZE);

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

    // If we got fewer results than the batch size, we've reached the end
    if (freeUserLinks.length < QUERY_BATCH_SIZE) {
      hasMoreFree = false;
    }
  }

  // Process pro users with cursor-based pagination
  let lastProId = 0;
  let hasMorePro = true;

  while (hasMorePro) {
    const proUserLinks = await db
      .select({ linkId: link.id })
      .from(link)
      .innerJoin(subscription, eq(link.userId, subscription.userId))
      .where(
        and(
          sql`${link.id} > ${lastProId}`,
          sql`${link.teamId} IS NULL`, // Only personal workspace links
          eq(subscription.status, "active"),
          eq(subscription.plan, "pro")
        )
      )
      .orderBy(link.id)
      .limit(QUERY_BATCH_SIZE);

    if (proUserLinks.length === 0) {
      hasMorePro = false;
      break;
    }

    const proLinkIds = proUserLinks.map((l) => l.linkId);
    lastProId = proLinkIds[proLinkIds.length - 1] ?? lastProId;
    result.proUsersProcessed += proLinkIds.length;

    // Delete old link visits for pro users in batches
    for (let i = 0; i < proLinkIds.length; i += DELETE_BATCH_SIZE) {
      const batch = proLinkIds.slice(i, i + DELETE_BATCH_SIZE);

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

    // If we got fewer results than the batch size, we've reached the end
    if (proUserLinks.length < QUERY_BATCH_SIZE) {
      hasMorePro = false;
    }
  }

  // Note: Ultra users have unlimited retention, so no cleanup for them
  // Note: Team links inherit from team owner's plan - for simplicity, we skip team links here
  // Team analytics cleanup could be added as a separate feature if needed

  return result;
}

/**
 * Get stats about analytics data pending cleanup (for monitoring).
 * Counts are filtered by subscription tier to accurately reflect what will be deleted:
 * - Free tier visits: Records older than 30 days for users without active pro/ultra subscription
 * - Pro tier visits: Records older than 1 year for users with active pro subscription
 * - Ultra tier visits are never deleted (not counted here)
 */
export async function getAnalyticsCleanupStats() {
  const freeCutoffDate = new Date();
  freeCutoffDate.setDate(freeCutoffDate.getDate() - FREE_RETENTION_DAYS);

  const proCutoffDate = new Date();
  proCutoffDate.setDate(proCutoffDate.getDate() - PRO_RETENTION_DAYS);

  // Count LinkVisit records for free users older than 30 days
  // Free users: no subscription, inactive subscription, or free plan
  const oldFreeVisits = await db
    .select({ count: sql<number>`count(*)` })
    .from(linkVisit)
    .innerJoin(link, eq(linkVisit.linkId, link.id))
    .leftJoin(subscription, eq(link.userId, subscription.userId))
    .where(
      and(
        lt(linkVisit.createdAt, freeCutoffDate),
        sql`${link.teamId} IS NULL`,
        sql`(${subscription.id} IS NULL OR ${subscription.status} != 'active' OR ${subscription.plan} = 'free')`
      )
    );

  // Count LinkVisit records for pro users older than 1 year
  const oldProVisits = await db
    .select({ count: sql<number>`count(*)` })
    .from(linkVisit)
    .innerJoin(link, eq(linkVisit.linkId, link.id))
    .innerJoin(subscription, eq(link.userId, subscription.userId))
    .where(
      and(
        lt(linkVisit.createdAt, proCutoffDate),
        sql`${link.teamId} IS NULL`,
        eq(subscription.status, "active"),
        eq(subscription.plan, "pro")
      )
    );

  return {
    freeUserVisitsPendingCleanup: Number(oldFreeVisits[0]?.count ?? 0),
    proUserVisitsPendingCleanup: Number(oldProVisits[0]?.count ?? 0),
    freeRetentionDays: FREE_RETENTION_DAYS,
    proRetentionDays: PRO_RETENTION_DAYS,
  };
}

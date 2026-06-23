import { and, count, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  bioPage,
  bioPageView,
  bioPageViewDailySummary,
  link,
  linkVisit,
  linkVisitDailySummary,
  subscription,
  team,
  uniqueBioPageView,
  uniqueLinkVisit,
} from "@/server/db/schema";

// Retention periods in days
const FREE_RETENTION_DAYS = 30;
const PRO_RETENTION_DAYS = 365; // 1 year

interface AnalyticsCleanupResult {
  linkVisitsDeleted: number;
  uniqueLinkVisitsDeleted: number;
  dailySummariesCreated: number;
  freeLinksProcessed: number;
  proLinksProcessed: number;
  bioPageViewsDeleted: number;
  uniqueBioPageViewsDeleted: number;
}

// Batch size for paginated queries and deletes
const QUERY_BATCH_SIZE = 5000;
const DELETE_BATCH_SIZE = 1000;

// SQL predicate: user has no active paid subscription (free tier)
const IS_FREE_TIER = sql`(${subscription.id} IS NULL OR ${subscription.status} != 'active' OR ${subscription.plan} = 'free')`;

/**
 * Clean up old analytics data based on user subscription plan.
 * - Free users: Delete LinkVisit and UniqueLinkVisit records older than 30 days
 * - Pro users: Delete LinkVisit and UniqueLinkVisit records older than 1 year
 * - Ultra users: No cleanup (unlimited retention)
 *
 * Before deleting, aggregates raw visits into LinkVisitDailySummary to preserve
 * historical click trends beyond the retention window.
 *
 * Handles both personal workspace links (plan resolved via user's subscription)
 * and team workspace links (plan resolved via team owner's subscription).
 *
 * Uses cursor-based pagination to avoid memory issues with large datasets.
 * Should be called by a weekly cron job.
 */
export async function cleanupAnalyticsData(): Promise<AnalyticsCleanupResult> {
  const result: AnalyticsCleanupResult = {
    linkVisitsDeleted: 0,
    uniqueLinkVisitsDeleted: 0,
    dailySummariesCreated: 0,
    freeLinksProcessed: 0,
    proLinksProcessed: 0,
    bioPageViewsDeleted: 0,
    uniqueBioPageViewsDeleted: 0,
  };

  // Calculate cutoff dates
  const freeCutoffDate = new Date();
  freeCutoffDate.setDate(freeCutoffDate.getDate() - FREE_RETENTION_DAYS);

  const proCutoffDate = new Date();
  proCutoffDate.setDate(proCutoffDate.getDate() - PRO_RETENTION_DAYS);

  // --- Free tier: personal workspace links ---
  await processLinkBatch(
    result,
    "free",
    freeCutoffDate,
    (lastId) =>
      db
        .select({ linkId: link.id })
        .from(link)
        .leftJoin(subscription, eq(link.userId, subscription.userId))
        .where(
          and(
            sql`${link.id} > ${lastId}`,
            isNull(link.teamId),
            IS_FREE_TIER,
          ),
        )
        .orderBy(link.id)
        .limit(QUERY_BATCH_SIZE),
  );

  // --- Free tier: team workspace links (team owner has no active paid subscription) ---
  await processLinkBatch(
    result,
    "free",
    freeCutoffDate,
    (lastId) =>
      db
        .select({ linkId: link.id })
        .from(link)
        .innerJoin(team, eq(link.teamId, team.id))
        .leftJoin(subscription, eq(team.ownerId, subscription.userId))
        .where(
          and(
            sql`${link.id} > ${lastId}`,
            isNotNull(link.teamId),
            IS_FREE_TIER,
          ),
        )
        .orderBy(link.id)
        .limit(QUERY_BATCH_SIZE),
  );

  // --- Pro tier: personal workspace links ---
  await processLinkBatch(
    result,
    "pro",
    proCutoffDate,
    (lastId) =>
      db
        .select({ linkId: link.id })
        .from(link)
        .innerJoin(subscription, eq(link.userId, subscription.userId))
        .where(
          and(
            sql`${link.id} > ${lastId}`,
            isNull(link.teamId),
            eq(subscription.status, "active"),
            eq(subscription.plan, "pro"),
          ),
        )
        .orderBy(link.id)
        .limit(QUERY_BATCH_SIZE),
  );

  // --- Pro tier: team workspace links (team owner has active pro subscription) ---
  await processLinkBatch(
    result,
    "pro",
    proCutoffDate,
    (lastId) =>
      db
        .select({ linkId: link.id })
        .from(link)
        .innerJoin(team, eq(link.teamId, team.id))
        .innerJoin(subscription, eq(team.ownerId, subscription.userId))
        .where(
          and(
            sql`${link.id} > ${lastId}`,
            isNotNull(link.teamId),
            eq(subscription.status, "active"),
            eq(subscription.plan, "pro"),
          ),
        )
        .orderBy(link.id)
        .limit(QUERY_BATCH_SIZE),
  );

  // --- Bio page views: same tier-based retention as link visits ---
  await cleanupBioPageViews(result, freeCutoffDate, proCutoffDate);

  // Note: Ultra users (personal and team) have unlimited retention — no cleanup

  return result;
}

/**
 * Roll up + prune raw bio-page view records by owner plan, mirroring the link
 * visit cleanup. Free pages keep 30 days, Pro 365, Ultra unlimited.
 */
async function cleanupBioPageViews(
  result: AnalyticsCleanupResult,
  freeCutoffDate: Date,
  proCutoffDate: Date,
): Promise<void> {
  // Free: personal pages
  await processBioPageBatch(result, freeCutoffDate, (lastId) =>
    db
      .select({ bioPageId: bioPage.id })
      .from(bioPage)
      .leftJoin(subscription, eq(bioPage.userId, subscription.userId))
      .where(and(sql`${bioPage.id} > ${lastId}`, isNull(bioPage.teamId), IS_FREE_TIER))
      .orderBy(bioPage.id)
      .limit(QUERY_BATCH_SIZE),
  );
  // Free: team pages (owner has no active paid subscription)
  await processBioPageBatch(result, freeCutoffDate, (lastId) =>
    db
      .select({ bioPageId: bioPage.id })
      .from(bioPage)
      .innerJoin(team, eq(bioPage.teamId, team.id))
      .leftJoin(subscription, eq(team.ownerId, subscription.userId))
      .where(and(sql`${bioPage.id} > ${lastId}`, isNotNull(bioPage.teamId), IS_FREE_TIER))
      .orderBy(bioPage.id)
      .limit(QUERY_BATCH_SIZE),
  );
  // Pro: personal pages
  await processBioPageBatch(result, proCutoffDate, (lastId) =>
    db
      .select({ bioPageId: bioPage.id })
      .from(bioPage)
      .innerJoin(subscription, eq(bioPage.userId, subscription.userId))
      .where(
        and(
          sql`${bioPage.id} > ${lastId}`,
          isNull(bioPage.teamId),
          eq(subscription.status, "active"),
          eq(subscription.plan, "pro"),
        ),
      )
      .orderBy(bioPage.id)
      .limit(QUERY_BATCH_SIZE),
  );
  // Pro: team pages
  await processBioPageBatch(result, proCutoffDate, (lastId) =>
    db
      .select({ bioPageId: bioPage.id })
      .from(bioPage)
      .innerJoin(team, eq(bioPage.teamId, team.id))
      .innerJoin(subscription, eq(team.ownerId, subscription.userId))
      .where(
        and(
          sql`${bioPage.id} > ${lastId}`,
          isNotNull(bioPage.teamId),
          eq(subscription.status, "active"),
          eq(subscription.plan, "pro"),
        ),
      )
      .orderBy(bioPage.id)
      .limit(QUERY_BATCH_SIZE),
  );
}

async function processBioPageBatch(
  result: AnalyticsCleanupResult,
  cutoffDate: Date,
  queryFn: (lastId: number) => Promise<{ bioPageId: number }[]>,
): Promise<void> {
  let lastId = 0;

  while (true) {
    const pages = await queryFn(lastId);
    if (pages.length === 0) break;

    const ids = pages.map((p) => p.bioPageId);
    lastId = ids[ids.length - 1] ?? lastId;

    for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
      const batch = ids.slice(i, i + DELETE_BATCH_SIZE);

      result.dailySummariesCreated += await aggregateBioDailySummaries(batch, cutoffDate);

      const [viewRes, uniqueRes] = await Promise.all([
        db
          .delete(bioPageView)
          .where(
            and(inArray(bioPageView.bioPageId, batch), lt(bioPageView.createdAt, cutoffDate)),
          ),
        db
          .delete(uniqueBioPageView)
          .where(
            and(
              inArray(uniqueBioPageView.bioPageId, batch),
              lt(uniqueBioPageView.createdAt, cutoffDate),
            ),
          ),
      ]);
      result.bioPageViewsDeleted += viewRes[0].affectedRows;
      result.uniqueBioPageViewsDeleted += uniqueRes[0].affectedRows;
    }

    if (pages.length < QUERY_BATCH_SIZE) break;
  }
}

async function aggregateBioDailySummaries(
  bioPageIds: number[],
  cutoffDate: Date,
): Promise<number> {
  const [viewAgg, uniqueAgg] = await Promise.all([
    db
      .select({
        bioPageId: bioPageView.bioPageId,
        date: sql<string>`DATE(${bioPageView.createdAt})`.as("view_date"),
        views: count().as("views"),
      })
      .from(bioPageView)
      .where(and(inArray(bioPageView.bioPageId, bioPageIds), lt(bioPageView.createdAt, cutoffDate)))
      .groupBy(bioPageView.bioPageId, sql`view_date`),
    db
      .select({
        bioPageId: uniqueBioPageView.bioPageId,
        date: sql<string>`DATE(${uniqueBioPageView.createdAt})`.as("view_date"),
        uniqueViews: count().as("unique_views"),
      })
      .from(uniqueBioPageView)
      .where(
        and(
          inArray(uniqueBioPageView.bioPageId, bioPageIds),
          lt(uniqueBioPageView.createdAt, cutoffDate),
        ),
      )
      .groupBy(uniqueBioPageView.bioPageId, sql`view_date`),
  ]);

  if (viewAgg.length === 0 && uniqueAgg.length === 0) return 0;

  const summaryMap = new Map<
    string,
    { bioPageId: number; date: string; views: number; uniqueViews: number }
  >();

  for (const row of viewAgg) {
    summaryMap.set(`${row.bioPageId}:${row.date}`, {
      bioPageId: row.bioPageId,
      date: row.date,
      views: row.views,
      uniqueViews: 0,
    });
  }
  for (const row of uniqueAgg) {
    const key = `${row.bioPageId}:${row.date}`;
    const existing = summaryMap.get(key);
    if (existing) existing.uniqueViews = row.uniqueViews;
    else
      summaryMap.set(key, {
        bioPageId: row.bioPageId,
        date: row.date,
        views: 0,
        uniqueViews: row.uniqueViews,
      });
  }

  const rows = Array.from(summaryMap.values());
  if (rows.length === 0) return 0;

  const UPSERT_BATCH = 500;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    await db
      .insert(bioPageViewDailySummary)
      .values(batch)
      .onDuplicateKeyUpdate({
        set: { views: sql`VALUES(views)`, uniqueViews: sql`VALUES(uniqueViews)` },
      });
    upserted += batch.length;
  }

  return upserted;
}

/**
 * Process a batch of links for a given tier: aggregate old visits into daily
 * summaries, then delete the raw records.
 */
async function processLinkBatch(
  result: AnalyticsCleanupResult,
  tier: "free" | "pro",
  cutoffDate: Date,
  queryFn: (
    lastId: number,
  ) => Promise<{ linkId: number }[]>,
): Promise<void> {
  let lastId = 0;

  while (true) {
    const links = await queryFn(lastId);
    if (links.length === 0) break;

    const linkIds = links.map((l) => l.linkId);
    lastId = linkIds[linkIds.length - 1] ?? lastId;

    if (tier === "free") {
      result.freeLinksProcessed += linkIds.length;
    } else {
      result.proLinksProcessed += linkIds.length;
    }

    // Process in delete-sized batches
    for (let i = 0; i < linkIds.length; i += DELETE_BATCH_SIZE) {
      const batch = linkIds.slice(i, i + DELETE_BATCH_SIZE);

      // Step 1: Aggregate old visits into daily summaries before deletion
      result.dailySummariesCreated += await aggregateDailySummaries(
        batch,
        cutoffDate,
      );

      // Step 2: Delete old raw records from both tables (independent, safe to parallelize)
      const [linkVisitResult, uniqueVisitResult] = await Promise.all([
        db
          .delete(linkVisit)
          .where(
            and(
              inArray(linkVisit.linkId, batch),
              lt(linkVisit.createdAt, cutoffDate),
            ),
          ),
        db
          .delete(uniqueLinkVisit)
          .where(
            and(
              inArray(uniqueLinkVisit.linkId, batch),
              lt(uniqueLinkVisit.createdAt, cutoffDate),
            ),
          ),
      ]);
      result.linkVisitsDeleted += linkVisitResult[0].affectedRows;
      result.uniqueLinkVisitsDeleted += uniqueVisitResult[0].affectedRows;
    }

    if (links.length < QUERY_BATCH_SIZE) break;
  }
}

/**
 * Aggregate raw LinkVisit and UniqueLinkVisit records older than the cutoff
 * into LinkVisitDailySummary rows (one per link per day). Uses INSERT ... ON
 * DUPLICATE KEY UPDATE to merge with any existing summaries.
 *
 * Returns the number of summary rows upserted.
 */
async function aggregateDailySummaries(
  linkIds: number[],
  cutoffDate: Date,
): Promise<number> {
  // Aggregate total clicks and unique clicks per link per day (in parallel)
  const [clickAgg, uniqueAgg] = await Promise.all([
    db
      .select({
        linkId: linkVisit.linkId,
        date: sql<string>`DATE(${linkVisit.createdAt})`.as("visit_date"),
        clicks: count().as("clicks"),
      })
      .from(linkVisit)
      .where(
        and(inArray(linkVisit.linkId, linkIds), lt(linkVisit.createdAt, cutoffDate)),
      )
      .groupBy(linkVisit.linkId, sql`visit_date`),
    db
      .select({
        linkId: uniqueLinkVisit.linkId,
        date: sql<string>`DATE(${uniqueLinkVisit.createdAt})`.as("visit_date"),
        uniqueClicks: count().as("unique_clicks"),
      })
      .from(uniqueLinkVisit)
      .where(
        and(
          inArray(uniqueLinkVisit.linkId, linkIds),
          lt(uniqueLinkVisit.createdAt, cutoffDate),
        ),
      )
      .groupBy(uniqueLinkVisit.linkId, sql`visit_date`),
  ]);

  if (clickAgg.length === 0 && uniqueAgg.length === 0) {
    return 0;
  }

  // Merge clicks and unique clicks into a single map keyed by "linkId:date"
  const summaryMap = new Map<
    string,
    { linkId: number; date: string; clicks: number; uniqueClicks: number }
  >();

  for (const row of clickAgg) {
    const key = `${row.linkId}:${row.date}`;
    summaryMap.set(key, {
      linkId: row.linkId,
      date: row.date,
      clicks: row.clicks,
      uniqueClicks: 0,
    });
  }

  for (const row of uniqueAgg) {
    const key = `${row.linkId}:${row.date}`;
    const existing = summaryMap.get(key);
    if (existing) {
      existing.uniqueClicks = row.uniqueClicks;
    } else {
      summaryMap.set(key, {
        linkId: row.linkId,
        date: row.date,
        clicks: 0,
        uniqueClicks: row.uniqueClicks,
      });
    }
  }

  const rows = Array.from(summaryMap.values());
  if (rows.length === 0) return 0;

  // Upsert in batches — ON DUPLICATE KEY UPDATE overwrites (not accumulates)
  // so that retries after a partial failure are idempotent.
  const UPSERT_BATCH = 500;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    await db
      .insert(linkVisitDailySummary)
      .values(batch)
      .onDuplicateKeyUpdate({
        set: {
          clicks: sql`VALUES(clicks)`,
          uniqueClicks: sql`VALUES(uniqueClicks)`,
        },
      });
    upserted += batch.length;
  }

  return upserted;
}

/**
 * Get stats about analytics data pending cleanup (for monitoring).
 */
export async function getAnalyticsCleanupStats() {
  const freeCutoffDate = new Date();
  freeCutoffDate.setDate(freeCutoffDate.getDate() - FREE_RETENTION_DAYS);

  const proCutoffDate = new Date();
  proCutoffDate.setDate(proCutoffDate.getDate() - PRO_RETENTION_DAYS);

  const [oldFreeVisits, oldProVisits, oldFreeTeamVisits, oldProTeamVisits] =
    await Promise.all([
      // Free personal workspace visits
      db
        .select({ count: sql<number>`count(*)` })
        .from(linkVisit)
        .innerJoin(link, eq(linkVisit.linkId, link.id))
        .leftJoin(subscription, eq(link.userId, subscription.userId))
        .where(
          and(
            lt(linkVisit.createdAt, freeCutoffDate),
            isNull(link.teamId),
            IS_FREE_TIER,
          ),
        ),
      // Pro personal workspace visits
      db
        .select({ count: sql<number>`count(*)` })
        .from(linkVisit)
        .innerJoin(link, eq(linkVisit.linkId, link.id))
        .innerJoin(subscription, eq(link.userId, subscription.userId))
        .where(
          and(
            lt(linkVisit.createdAt, proCutoffDate),
            isNull(link.teamId),
            eq(subscription.status, "active"),
            eq(subscription.plan, "pro"),
          ),
        ),
      // Free team workspace visits
      db
        .select({ count: sql<number>`count(*)` })
        .from(linkVisit)
        .innerJoin(link, eq(linkVisit.linkId, link.id))
        .innerJoin(team, eq(link.teamId, team.id))
        .leftJoin(subscription, eq(team.ownerId, subscription.userId))
        .where(
          and(
            lt(linkVisit.createdAt, freeCutoffDate),
            isNotNull(link.teamId),
            IS_FREE_TIER,
          ),
        ),
      // Pro team workspace visits
      db
        .select({ count: sql<number>`count(*)` })
        .from(linkVisit)
        .innerJoin(link, eq(linkVisit.linkId, link.id))
        .innerJoin(team, eq(link.teamId, team.id))
        .innerJoin(subscription, eq(team.ownerId, subscription.userId))
        .where(
          and(
            lt(linkVisit.createdAt, proCutoffDate),
            isNotNull(link.teamId),
            eq(subscription.status, "active"),
            eq(subscription.plan, "pro"),
          ),
        ),
    ]);

  return {
    freeUserVisitsPendingCleanup:
      Number(oldFreeVisits[0]?.count ?? 0) +
      Number(oldFreeTeamVisits[0]?.count ?? 0),
    proUserVisitsPendingCleanup:
      Number(oldProVisits[0]?.count ?? 0) +
      Number(oldProTeamVisits[0]?.count ?? 0),
    freeRetentionDays: FREE_RETENTION_DAYS,
    proRetentionDays: PRO_RETENTION_DAYS,
  };
}

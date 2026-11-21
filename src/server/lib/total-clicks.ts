import { type Column, type Table, count, eq, sql, sum } from "drizzle-orm";

import { db } from "@/server/db";
import { link, linkVisit, linkVisitDailySummary } from "@/server/db/schema";

/**
 * Get the true total click count for a link by combining:
 * - Archived clicks from the daily summary table (survives analytics cleanup)
 * - Recent raw clicks not yet rolled up
 */
export async function getTotalClicks(linkId: number): Promise<number> {
  const [summaryResult, rawResult] = await Promise.all([
    db
      .select({ total: sum(linkVisitDailySummary.clicks) })
      .from(linkVisitDailySummary)
      .where(eq(linkVisitDailySummary.linkId, linkId)),
    db.select({ total: count() }).from(linkVisit).where(eq(linkVisit.linkId, linkId)),
  ]);

  const archivedClicks = Number(summaryResult[0]?.total) || 0;
  const recentClicks = rawResult[0]?.total ?? 0;
  return archivedClicks + recentClicks;
}

// Drizzle drops the table name from columns in single-table selects, which would bind `id` in
// the correlated subqueries below to the inner table.
const qualified = (table: Table, column: Column) => sql`${table}.${sql.identifier(column.name)}`;

/**
 * Visits counted toward the Link row's click limit. Until the counter is started it is the
 * recorded total (getTotalClicks); COALESCE only evaluates those subqueries while it is null.
 */
export const clicksTowardLimitSql = sql`coalesce(${qualified(link, link.clickLimitCount)}, (
  select coalesce(sum(${qualified(linkVisitDailySummary, linkVisitDailySummary.clicks)}), 0) from ${linkVisitDailySummary}
  where ${qualified(linkVisitDailySummary, linkVisitDailySummary.linkId)} = ${qualified(link, link.id)}
) + (
  select count(*) from ${linkVisit}
  where ${qualified(linkVisit, linkVisit.linkId)} = ${qualified(link, link.id)}
))`;

/** One primary-key lookup once the link's counter has started. */
export async function getClicksTowardLimit(linkId: number): Promise<number> {
  const [row] = await db
    .select({ clicks: clicksTowardLimitSql.mapWith(Number) })
    .from(link)
    .where(eq(link.id, linkId));
  return row?.clicks ?? 0;
}

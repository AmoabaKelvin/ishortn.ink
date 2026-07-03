import { count, eq, sum } from "drizzle-orm";

import { db } from "@/server/db";
import { linkVisit, linkVisitDailySummary } from "@/server/db/schema";

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
    db
      .select({ total: count() })
      .from(linkVisit)
      .where(eq(linkVisit.linkId, linkId)),
  ]);

  const archivedClicks = Number(summaryResult[0]?.total) || 0;
  const recentClicks = rawResult[0]?.total ?? 0;
  return archivedClicks + recentClicks;
}

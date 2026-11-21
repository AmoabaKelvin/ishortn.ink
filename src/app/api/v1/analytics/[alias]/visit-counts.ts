import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { linkVisit, uniqueLinkVisit } from "@/server/db/schema";

import type { SQL } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

const BREAKDOWNS = {
  clicksPerCountry: linkVisit.country,
  clicksPerCity: linkVisit.city,
  clicksPerContinent: linkVisit.continent,
  clicksPerDevice: linkVisit.device,
  clicksPerOS: linkVisit.os,
  clicksPerBrowser: linkVisit.browser,
  clicksPerModel: linkVisit.model,
};

type Breakdown = keyof typeof BREAKDOWNS;

const isBreakdown = (dim: string): dim is Breakdown => Object.hasOwn(BREAKDOWNS, dim);

const visitCountRow = z.object({
  dim: z.string(),
  k: z.string(),
  n: z.coerce.number(),
  v: z.coerce.number(),
});

export type VisitCountRow = z.infer<typeof visitCountRow>;

/**
 * Counts a link's visits per day and per breakdown in one round trip, so the
 * response costs the same however many visits the link has. Days are UTC dates
 * (the database runs in UTC), matching the dashboard's per-day series.
 */
export async function countVisits(linkId: number, from: Date | null): Promise<VisitCountRow[]> {
  const visits = and(
    eq(linkVisit.linkId, linkId),
    from ? gte(linkVisit.createdAt, from) : undefined,
  );
  const uniqueVisits = and(
    eq(uniqueLinkVisit.linkId, linkId),
    from ? gte(uniqueLinkVisit.createdAt, from) : undefined,
  );

  const day = (column: AnyMySqlColumn) => sql`DATE_FORMAT(${column}, '%Y-%m-%d')`;

  const parts: SQL[] = [
    sql`SELECT 'date' AS dim, ${day(linkVisit.createdAt)} AS k, COUNT(*) AS n, SUM(${linkVisit.verifiedAt} IS NOT NULL) AS v FROM ${linkVisit} WHERE ${visits} GROUP BY k`,
    sql`SELECT 'unique' AS dim, ${day(uniqueLinkVisit.createdAt)} AS k, COUNT(*) AS n, 0 AS v FROM ${uniqueLinkVisit} WHERE ${uniqueVisits} GROUP BY k`,
    ...Object.entries(BREAKDOWNS).map(
      ([dim, column]) =>
        sql`SELECT ${dim} AS dim, ${column} AS k, COUNT(*) AS n, 0 AS v FROM ${linkVisit} WHERE ${visits} AND ${column} <> '' GROUP BY ${column}`,
    ),
  ];

  const [rows] = await db.execute(sql.join(parts, sql` UNION ALL `));
  return z.array(visitCountRow).parse(rows);
}

const counts = (): Record<string, number> => ({});

/** Shapes grouped counts into the analytics response (same keys as `aggregateVisits`). */
export function foldVisitCounts(rows: VisitCountRow[]) {
  const result = {
    totalClicks: 0,
    verifiedClicks: 0,
    clicksPerDate: counts(),
    uniqueClicksPerDate: counts(),
    verifiedClicksPerDate: counts(),
    clicksPerCountry: counts(),
    clicksPerCity: counts(),
    clicksPerContinent: counts(),
    clicksPerDevice: counts(),
    clicksPerOS: counts(),
    clicksPerBrowser: counts(),
    clicksPerModel: counts(),
  };

  for (const row of rows) {
    if (row.dim === "date") {
      result.totalClicks += row.n;
      result.clicksPerDate[row.k] = row.n;
      if (row.v > 0) {
        result.verifiedClicks += row.v;
        result.verifiedClicksPerDate[row.k] = row.v;
      }
    } else if (row.dim === "unique") {
      result.uniqueClicksPerDate[row.k] = row.n;
    } else if (isBreakdown(row.dim)) {
      result[row.dim][row.k] = row.n;
    }
  }

  return result;
}

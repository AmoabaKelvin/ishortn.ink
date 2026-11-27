import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { link, linkHealth } from "@/server/db/schema";

import type { Plan } from "@/lib/billing/plans";
import type { db as Database } from "@/server/db";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";

export const notSet = (column: AnyMySqlColumn) => or(isNull(column), eq(column, false));

/** Links the job checks; health rows on any other link are stale and never shown. */
export const liveLink = () =>
  and(notSet(link.archived), notSet(link.blocked), notSet(link.disabled), isNotNull(link.url));

/** What the "Destination down" badge shows. */
export type DestinationDown = {
  lastStatus: number | null;
  lastError: string | null;
  lastCheckedAt: Date;
  brokenSince: Date;
};

/**
 * One query for a page of links: the live ones whose destination is down. Pro and Ultra only;
 * Free workspaces get an empty map without a query.
 */
export async function getDestinationDownByLinkId(
  db: typeof Database,
  plan: Plan,
  linkIds: number[],
): Promise<Map<number, DestinationDown>> {
  if (plan === "free" || linkIds.length === 0) return new Map();

  const rows = await db
    .select({
      linkId: linkHealth.linkId,
      lastStatus: linkHealth.lastStatus,
      lastError: linkHealth.lastError,
      lastCheckedAt: linkHealth.lastCheckedAt,
      brokenSince: linkHealth.brokenSince,
    })
    .from(linkHealth)
    .innerJoin(link, eq(link.id, linkHealth.linkId))
    .where(and(inArray(linkHealth.linkId, linkIds), isNotNull(linkHealth.brokenSince), liveLink()));

  return new Map(
    rows.flatMap(({ linkId, brokenSince, ...rest }) =>
      brokenSince ? [[linkId, { ...rest, brokenSince }] as const] : [],
    ),
  );
}

/**
 * Forgets a link's health after its destination changes: the old URL's failure streak and
 * alert must not carry over to the new one, which the next run checks first.
 */
export async function resetLinkHealth(db: Pick<typeof Database, "delete">, linkId: number) {
  await db.delete(linkHealth).where(eq(linkHealth.linkId, linkId));
}

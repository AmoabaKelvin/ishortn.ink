import { and, inArray, isNotNull } from "drizzle-orm";

import { linkHealth } from "@/server/db/schema";

import type { Plan } from "@/lib/billing/plans";
import type { db as Database } from "@/server/db";

/** What the "Destination down" badge shows. */
export type DestinationDown = {
  lastStatus: number | null;
  lastError: string | null;
  lastCheckedAt: Date;
  brokenSince: Date;
};

/**
 * One query for a page of links: the ones whose destination is down. Pro and Ultra only; Free
 * workspaces get an empty map without a query.
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
    .where(and(inArray(linkHealth.linkId, linkIds), isNotNull(linkHealth.brokenSince)));

  return new Map(
    rows.flatMap(({ linkId, brokenSince, ...rest }) =>
      brokenSince ? [[linkId, { ...rest, brokenSince }] as const] : [],
    ),
  );
}

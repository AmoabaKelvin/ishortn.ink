import { inArray } from "drizzle-orm";

import { geoRule } from "@/server/db/schema";

import type { TargetingRuleType } from "@/lib/constants/targeting";
import type { db as Database } from "@/server/db";

/** One query for a page of links: which targeting rule types each link has. */
export async function getTargetingTypesByLinkId(
  db: typeof Database,
  linkIds: number[],
): Promise<Map<number, TargetingRuleType[]>> {
  const byLink = new Map<number, TargetingRuleType[]>();
  if (linkIds.length === 0) return byLink;

  const rows = await db
    .selectDistinct({ linkId: geoRule.linkId, type: geoRule.type })
    .from(geoRule)
    .where(inArray(geoRule.linkId, linkIds));

  for (const row of rows) {
    const types = byLink.get(row.linkId);
    if (types) types.push(row.type);
    else byLink.set(row.linkId, [row.type]);
  }
  return byLink;
}

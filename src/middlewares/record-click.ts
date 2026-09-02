import { sql } from "drizzle-orm";

import { describeVisitor } from "@/lib/core/analytics/visitor";
import {
  type Link,
  buildCacheKey,
  getFromCache,
  normalizeDomain,
  setInCache,
} from "@/lib/core/cache";
import { runBackgroundTask } from "@/lib/utils/background";
import { generateVisitId } from "@/lib/utils/verified-click-token";
import { db } from "@/server/db";
import { enqueueClickEvent } from "@/server/lib/click-queue";

/**
 * Cache-first link lookup. No side effects except populating the cache on miss.
 * Returns null when the alias/domain pair doesn't resolve.
 */
export async function resolveLink(domain: string, alias: string): Promise<Link | null> {
  const cacheKey = buildCacheKey(domain, alias);
  const cached: Link | null = await getFromCache(cacheKey);
  if (cached) return cached;

  const link = await db.query.link.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.domain, normalizeDomain(domain)),
        sql`lower(${table.alias}) = lower(${alias.replace("/", "")})`,
      ),
  });
  if (!link) return null;

  await runBackgroundTask(setInCache(cacheKey, link));
  return link;
}

type RecordClickOptions = {
  headers: Headers;
  link: Link;
  ip: string;
  country: string;
  city: string;
  matchedGeoRuleId?: number;
  /** Set when a verified-click token was issued; the beacon finds the row by it. */
  visitId?: string | null;
};

/** Queues a click. Drops bots here; quota and persistence happen in the consumer. */
export async function recordClick(opts: RecordClickOptions): Promise<void> {
  const { headers, link, ip, country, city, matchedGeoRuleId, visitId } = opts;
  const visitor = await describeVisitor({ headers, ip, country, city });
  if (!visitor) return;

  await enqueueClickEvent({
    kind: "link",
    id: visitId ?? generateVisitId(),
    linkId: link.id,
    ownerId: link.userId,
    matchedGeoRuleId: matchedGeoRuleId ?? null,
    ...visitor,
  });
}

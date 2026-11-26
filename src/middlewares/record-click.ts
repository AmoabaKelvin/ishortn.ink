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
import { findLinkByAddress, isPreviousAddressOf } from "@/server/lib/link-address";

// Only dashboard and API edits evict a link's previous-address cache entries; the
// other paths that change a link (blocking, disabling, bulk actions) know just its
// current address, so these entries expire quickly instead. A minute is also about
// how long KV takes to propagate a delete.
const PREVIOUS_ADDRESS_CACHE_TTL = 60;

/**
 * Cache-first link lookup, by current or previous address. No side effects except
 * populating the cache on miss. Returns null when the alias/domain pair doesn't resolve.
 */
export async function resolveLink(domain: string, alias: string): Promise<Link | null> {
  const cacheKey = buildCacheKey(domain, alias);
  const cached: Link | null = await getFromCache(cacheKey);
  if (cached) return cached;

  const bareAlias = alias.replace("/", "");
  const link = await findLinkByAddress(db, normalizeDomain(domain), bareAlias);
  if (!link) return null;

  const ttl = isPreviousAddressOf(link, normalizeDomain(domain), bareAlias)
    ? PREVIOUS_ADDRESS_CACHE_TTL
    : undefined;
  await runBackgroundTask(setInCache(cacheKey, link, ttl));
  return link;
}

/**
 * Full link row by alias, cache-first. Server-only: the row carries the
 * destination, password hash and owner fields, so it must never be returned
 * from a public procedure as-is (see `retrieveOriginalUrl` in link.service.ts).
 */
export async function findLinkByAlias(input: { alias: string; domain: string }) {
  // The same lookup as the redirect, so previews and metadata also follow moved links.
  const found = await resolveLink(input.domain, input.alias);
  return found?.alias ? found : null;
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
    countsTowardLimit: !!link.disableLinkAfterClicks,
    ...visitor,
  });
}

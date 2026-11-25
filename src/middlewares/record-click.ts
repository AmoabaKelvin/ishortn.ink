import {
  type Link,
  buildCacheKey,
  getFromCache,
  normalizeDomain,
  setInCache,
} from "@/lib/core/cache";
import { runBackgroundTask } from "@/lib/utils/background";
import { db } from "@/server/db";
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

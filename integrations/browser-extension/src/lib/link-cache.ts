export const CACHE_TTL_MS = 10 * 60 * 1000;

export type CachedLink = {
  shortUrl: string;
  alias: string;
  domain: string;
  createdAt: string;
  cachedAt: number;
};

export type LinkCache = Record<string, CachedLink>;

const isFresh = (entry: CachedLink, now: number) =>
  now - entry.cachedAt >= 0 && now - entry.cachedAt < CACHE_TTL_MS;

export const pruneCache = (cache: LinkCache, now: number): LinkCache => {
  const next: LinkCache = {};
  for (const [url, entry] of Object.entries(cache)) {
    if (isFresh(entry, now)) next[url] = entry;
  }
  return next;
};

export const lookupCachedLink = (
  cache: LinkCache | undefined,
  tabUrl: string,
  now: number,
): CachedLink | null => {
  const entry = cache?.[tabUrl];
  return entry && isFresh(entry, now) ? entry : null;
};

export const withCachedLink = (
  cache: LinkCache | undefined,
  tabUrl: string,
  link: Omit<CachedLink, "cachedAt">,
  now: number,
): LinkCache => ({ ...pruneCache(cache ?? {}, now), [tabUrl]: { ...link, cachedAt: now } });

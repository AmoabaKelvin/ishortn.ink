import { z } from "zod";

import { DEFAULT_PLATFORM_DOMAIN } from "@/lib/constants/domains";
import { getCloudflareEnv } from "@/lib/platform";

import type { GeoRule, Link } from "@/server/db/schema";

const DEFAULT_CACHE_TTL = 60 * 60 * 24;
// KV rejects expirationTtl below 60 seconds.
const MIN_KV_TTL = 60;

async function getKV(): Promise<KVNamespace | null> {
  return (await getCloudflareEnv())?.LINK_CACHE_KV ?? null;
}

function clampTtl(ttlSeconds: number): number {
  return Math.max(ttlSeconds, MIN_KV_TTL);
}

type CachedLink = Omit<Link, "createdAt" | "disableLinkAfterDate" | "activateAt" | "blockedAt"> & {
  createdAt: string | null;
  disableLinkAfterDate: string | null;
  activateAt: string | null;
  blockedAt: string | null;
};

async function getFromCache(key: string): Promise<Link | null> {
  try {
    const kv = await getKV();
    if (!kv) return null;

    const cached = await kv.get(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedLink | null;
    if (!parsed || typeof parsed.id !== "number" || typeof parsed.userId !== "string") {
      return null;
    }

    return {
      ...parsed,
      createdAt: parsed.createdAt ? new Date(parsed.createdAt) : null,
      disableLinkAfterDate: parsed.disableLinkAfterDate
        ? new Date(parsed.disableLinkAfterDate)
        : null,
      activateAt: parsed.activateAt ? new Date(parsed.activateAt) : null,
      blockedAt: parsed.blockedAt ? new Date(parsed.blockedAt) : null,
    };
  } catch (_error) {
    return null;
  }
}

async function setInCache(
  key: string,
  link: Link,
  ttlSeconds: number = DEFAULT_CACHE_TTL,
): Promise<boolean> {
  try {
    const kv = await getKV();
    if (!kv) return false;

    await kv.put(key, JSON.stringify(link), { expirationTtl: clampTtl(ttlSeconds) });
    return true;
  } catch (_error) {
    return false;
  }
}

async function deleteFromCache(key: string): Promise<boolean> {
  try {
    const kv = await getKV();
    if (!kv) return false;

    await kv.delete(key);
    return true;
  } catch (_error) {
    return false;
  }
}

async function getStringFromCache(key: string): Promise<string | null> {
  try {
    const kv = await getKV();
    if (!kv) return null;

    return await kv.get(key);
  } catch (_error) {
    return null;
  }
}

async function setStringInCache(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  try {
    const kv = await getKV();
    if (!kv) return false;

    await kv.put(key, value, { expirationTtl: clampTtl(ttlSeconds) });
    return true;
  } catch (_error) {
    return false;
  }
}

// KV has no atomic set-if-absent, so this read-then-write can race under
// concurrency — acceptable for best-effort rate limiting.
async function setStringIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  try {
    const kv = await getKV();
    if (!kv) return false;

    if ((await kv.get(key)) !== null) return false;
    await kv.put(key, value, { expirationTtl: clampTtl(ttlSeconds) });
    return true;
  } catch (_error) {
    return false;
  }
}

// Geo rules cache functions
const GEO_RULES_CACHE_TTL = 60 * 60 * 24; // 24 hours
const GEO_RULES_CACHE_PREFIX = "geoRules:";

// Zod schema for geo rules
const geoRuleSchema = z.object({
  id: z.number(),
  linkId: z.number(),
  type: z.enum(["country", "continent", "device", "os"]),
  condition: z.enum(["in", "not_in"]),
  values: z.array(z.string()),
  action: z.enum(["redirect", "block"]),
  destination: z.string().nullable(),
  blockMessage: z.string().nullable(),
  priority: z.number(),
  createdAt: z
    .string()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
});

type CachedGeoRule = z.infer<typeof geoRuleSchema>;

async function getGeoRulesFromCache(linkId: number): Promise<CachedGeoRule[] | null> {
  try {
    const kv = await getKV();
    if (!kv) return null;

    const cached = await kv.get(`${GEO_RULES_CACHE_PREFIX}${linkId}`);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as unknown[];
    return parsed.map((rule) => geoRuleSchema.parse(rule));
  } catch (_error) {
    return null;
  }
}

async function setGeoRulesInCache(
  linkId: number,
  rules: GeoRule[],
  ttlSeconds: number = GEO_RULES_CACHE_TTL,
): Promise<boolean> {
  try {
    const kv = await getKV();
    if (!kv) return false;

    const key = `${GEO_RULES_CACHE_PREFIX}${linkId}`;
    await kv.put(key, JSON.stringify(rules), { expirationTtl: clampTtl(ttlSeconds) });
    return true;
  } catch (_error) {
    return false;
  }
}

async function deleteGeoRulesFromCache(linkId: number): Promise<boolean> {
  try {
    const kv = await getKV();
    if (!kv) return false;

    await kv.delete(`${GEO_RULES_CACHE_PREFIX}${linkId}`);
    return true;
  } catch (_error) {
    return false;
  }
}

/** Normalize a raw domain by stripping protocol, www prefix, and mapping localhost to default. */
function normalizeDomain(domain: string): string {
  const cleaned = domain.replace(/^https?:\/\//, "").replace(/^www\./, "");
  return domain.includes("localhost") ? DEFAULT_PLATFORM_DOMAIN : cleaned;
}

/** Build a cache key from a raw (possibly protocol-prefixed) domain and alias. */
function buildCacheKey(domain: string, alias: string): string {
  return `${normalizeDomain(domain)}:${alias.toLowerCase()}`;
}

export {
  buildCacheKey,
  normalizeDomain,
  deleteFromCache,
  deleteGeoRulesFromCache,
  getFromCache,
  getGeoRulesFromCache,
  getStringFromCache,
  setGeoRulesInCache,
  setInCache,
  setStringIfAbsent,
  setStringInCache,
  type CachedGeoRule,
  type Link,
};

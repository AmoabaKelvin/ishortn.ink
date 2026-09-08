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

const nullableIsoDate = z
  .string()
  .nullable()
  .transform((value) => (value ? new Date(value) : null));

const cachedLinkSchema = z.object({
  id: z.number(),
  name: z.string().nullable(),
  url: z.string().nullable(),
  alias: z.string().nullable(),
  domain: z.string(),
  createdAt: nullableIsoDate,
  disableLinkAfterClicks: z.number().nullable(),
  disableLinkAfterDate: nullableIsoDate,
  activateAt: nullableIsoDate,
  disabled: z.boolean().nullable(),
  publicStats: z.boolean().nullable(),
  userId: z.string(),
  teamId: z.number().nullable(),
  createdByUserId: z.string().nullable(),
  passwordHash: z.string().nullable(),
  note: z.string().nullable(),
  metadata: z.unknown(),
  utmParams: z
    .object({
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
      utm_term: z.string().optional(),
      utm_content: z.string().optional(),
    })
    .nullable(),
  tags: z.array(z.string()).nullable(),
  archived: z.boolean().nullable(),
  folderId: z.number().nullable(),
  campaignId: z.number().nullable(),
  cloaking: z.boolean().nullable(),
  verifiedClicksEnabled: z.boolean().nullable(),
  isQrCode: z.boolean().nullable(),
  isBioLink: z.boolean().nullable(),
  blocked: z.boolean().nullable(),
  blockedAt: nullableIsoDate,
  blockedReason: z.string().nullable(),
});

async function getFromCache(key: string): Promise<Link | null> {
  try {
    const kv = await getKV();
    if (!kv) return null;

    const cached = await kv.get(key);
    if (!cached) return null;

    const parsed = cachedLinkSchema.safeParse(JSON.parse(cached));
    return parsed.success ? parsed.data : null;
  } catch {
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
  } catch {
    return false;
  }
}

async function deleteFromCache(key: string): Promise<boolean> {
  try {
    const kv = await getKV();
    if (!kv) return false;

    await kv.delete(key);
    return true;
  } catch {
    return false;
  }
}

async function getStringFromCache(key: string): Promise<string | null> {
  try {
    const kv = await getKV();
    if (!kv) return null;

    return await kv.get(key);
  } catch {
    return null;
  }
}

async function setStringInCache(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  try {
    const kv = await getKV();
    if (!kv) return false;

    await kv.put(key, value, { expirationTtl: clampTtl(ttlSeconds) });
    return true;
  } catch {
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
  } catch {
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

    return z.array(geoRuleSchema).parse(JSON.parse(cached));
  } catch {
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
  } catch {
    return false;
  }
}

async function deleteGeoRulesFromCache(linkId: number): Promise<boolean> {
  try {
    const kv = await getKV();
    if (!kv) return false;

    await kv.delete(`${GEO_RULES_CACHE_PREFIX}${linkId}`);
    return true;
  } catch {
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

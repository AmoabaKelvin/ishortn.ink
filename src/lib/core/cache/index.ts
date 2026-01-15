import { Redis } from "ioredis";
import { z } from "zod";

import { env } from "@/env.mjs";

import type { Link } from "@/server/db/schema";

const linkSchema = z.object({
  id: z.string().transform((str) => Number(str)),
  url: z.string().url(),
  name: z.string().min(1),
  alias: z.string().min(1),
  userId: z.string().min(1),
  teamId: z
    .string()
    .nullable()
    .transform((val) => (val ? Number(val) : null))
    .default(null),
  createdAt: z.string().transform((str) => new Date(str)),
  disableLinkAfterClicks: z
    .string()
    .nullable()
    .transform((val) => (val ? Number(val) : null)),
  disableLinkAfterDate: z
    .string()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  disabled: z.string().transform((val) => val === "true"),
  publicStats: z.string().transform((val) => val === "true"),
  passwordHash: z.string(),
  domain: z.string().min(1),
  note: z.string(),
  metadata: z.string().transform((str) => JSON.parse(str)),
  tags: z
    .string()
    .transform((str) => JSON.parse(str) as string[])
    .default("[]"),
  archived: z.boolean().default(false),
  folderId: z
    .string()
    .nullable()
    .transform((val) => (val ? Number(val) : null))
    .default(null),
  utmParams: z
    .string()
    .nullable()
    .transform((str) => (str ? JSON.parse(str) : null))
    .default(null),
  createdByUserId: z.string().nullable().default(null),
  cloaking: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
});

export const redis = new Redis(env.REDIS_URL, {
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
});

const DEFAULT_CACHE_TTL = 60 * 60 * 24;

function convertToLink(data: Record<string, string>): Link {
  const parsed = linkSchema.parse(data);
  return {
    ...parsed,
    createdAt: new Date(parsed.createdAt),
    disableLinkAfterDate: parsed.disableLinkAfterDate
      ? new Date(parsed.disableLinkAfterDate)
      : null,
    metadata: parsed.metadata as Record<string, unknown>,
    tags: parsed.tags || [],
    archived: parsed.archived || false,
    folderId: parsed.folderId ?? null,
    teamId: parsed.teamId ?? null,
    utmParams: parsed.utmParams ?? null,
    createdByUserId: parsed.createdByUserId ?? null,
    cloaking: parsed.cloaking ?? false,
  };
}

async function getFromCache(key: string): Promise<Link | null> {
  try {
    const retrievedLink = await redis.hgetall(key);

    if (!Object.keys(retrievedLink).length) {
      return null;
    }

    return convertToLink(retrievedLink);
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
    const linkToStore = {
      ...link,
      createdAt: link.createdAt!.toISOString(),
      disableLinkAfterDate: link.disableLinkAfterDate?.toISOString() ?? null,
      metadata: JSON.stringify(link.metadata),
      utmParams: link.utmParams ? JSON.stringify(link.utmParams) : null,
    };

    const pipeline = redis.pipeline();
    pipeline.hset(key, linkToStore);
    pipeline.expire(key, ttlSeconds);

    await pipeline.exec();
    return true;
  } catch (_error) {
    return false;
  }
}

async function deleteFromCache(key: string): Promise<boolean> {
  try {
    const result = await redis.del(key);
    return result > 0;
  } catch (_error) {
    return false;
  }
}

// Geo rules cache functions
const GEO_RULES_CACHE_TTL = 60 * 60 * 24; // 24 hours
const GEO_RULES_CACHE_PREFIX = "geoRules:";

// Zod schema for geo rules
const geoRuleSchema = z.object({
  id: z.string().transform((str) => Number(str)),
  linkId: z.string().transform((str) => Number(str)),
  type: z.enum(["country", "continent"]),
  condition: z.enum(["in", "not_in"]),
  values: z.string().transform((str) => JSON.parse(str) as string[]),
  action: z.enum(["redirect", "block"]),
  destination: z.string().nullable(),
  blockMessage: z.string().nullable(),
  priority: z.string().transform((str) => Number(str)),
  createdAt: z.string().transform((str) => new Date(str) as Date | null),
});

type CachedGeoRule = z.infer<typeof geoRuleSchema>;

async function getGeoRulesFromCache(linkId: number): Promise<CachedGeoRule[] | null> {
  try {
    const key = `${GEO_RULES_CACHE_PREFIX}${linkId}`;
    const cached = await redis.get(key);

    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached) as Record<string, string>[];
    return parsed.map((rule) => geoRuleSchema.parse(rule));
  } catch (_error) {
    return null;
  }
}

async function setGeoRulesInCache(
  linkId: number,
  rules: {
    id: number;
    linkId: number;
    type: "country" | "continent";
    condition: "in" | "not_in";
    values: string[];
    action: "redirect" | "block";
    destination: string | null;
    blockMessage: string | null;
    priority: number;
    createdAt: Date | null;
  }[],
  ttlSeconds: number = GEO_RULES_CACHE_TTL
): Promise<boolean> {
  try {
    const key = `${GEO_RULES_CACHE_PREFIX}${linkId}`;
    const rulesToStore = rules.map((rule) => ({
      id: String(rule.id),
      linkId: String(rule.linkId),
      type: rule.type,
      condition: rule.condition,
      values: JSON.stringify(rule.values),
      action: rule.action,
      destination: rule.destination,
      blockMessage: rule.blockMessage,
      priority: String(rule.priority),
      createdAt: rule.createdAt?.toISOString() ?? new Date().toISOString(),
    }));

    await redis.set(key, JSON.stringify(rulesToStore), "EX", ttlSeconds);
    return true;
  } catch (_error) {
    return false;
  }
}

async function deleteGeoRulesFromCache(linkId: number): Promise<boolean> {
  try {
    const key = `${GEO_RULES_CACHE_PREFIX}${linkId}`;
    const result = await redis.del(key);
    return result > 0;
  } catch (_error) {
    return false;
  }
}

export {
  deleteFromCache,
  deleteGeoRulesFromCache,
  getFromCache,
  getGeoRulesFromCache,
  setGeoRulesInCache,
  setInCache,
  type CachedGeoRule,
  type Link,
};

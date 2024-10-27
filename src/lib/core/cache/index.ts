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
});

const redis = new Redis(env.REDIS_URL, {
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

export { deleteFromCache, getFromCache, setInCache, type Link };

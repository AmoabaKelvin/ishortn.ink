import { Redis } from "ioredis";

import { env } from "@/env.mjs";

import type { Link } from "@/server/db/schema";

export class Cache {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(env.REDIS_URL);
  }

  async get(key: string): Promise<Link | null> {
    try {
      const retrievedLink = await this.redis.hgetall(key);
      return convertToLink(retrievedLink);
    } catch (_error) {
      return null;
    }
  }

  async set(cacheKey: string, link: Link): Promise<boolean> {
    try {
      const linkToStore = {
        ...link,
        metadata: JSON.stringify(link.metadata),
      };
      await this.redis.hset(cacheKey, linkToStore);
      return true;
    } catch (_error) {
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (_error) {
      return false;
    }
  }
}

function convertToLink(link: Record<string, string>): Link | null {
  return {
    id: Number(link.id),
    url: link.url!,
    name: link.name!,
    alias: link.alias!,
    userId: link.userId!,
    createdAt: new Date(link.createdAt!),
    disableLinkAfterClicks: link.disableLinkAfterClicks
      ? Number(link.disableLinkAfterClicks)
      : null,
    disableLinkAfterDate: link.disableLinkAfterDate ? new Date(link.disableLinkAfterDate) : null,
    disabled: link.disabled === "true",
    publicStats: link.publicStats === "true",
    passwordHash: link.passwordHash!,
    domain: link.domain!,
    note: link.note!,
    metadata: JSON.parse(link.metadata!), // Deserialize metadata from string to object
  };
}

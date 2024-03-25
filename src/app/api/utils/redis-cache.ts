import { Redis } from "@upstash/redis";

import { env } from "@/env.mjs";

import type { Link } from "@prisma/client";
const redis = new Redis({
  url: env.UPSTASH_URL,
  token: env.UPSTASH_TOKEN,
});

const addLinkToRedisCache = async ({
  alias,
  url,
  disableLinkAfterClicks,
  disableLinkAfterDate,
  disabled,
  publicStats,
  userId,
  createdAt,
  id,
}: Link) => {
  try {
    const linkData = {
      url,
      disableLinkAfterClicks,
      disableLinkAfterDate,
      disabled,
      publicStats,
      userId,
      createdAt,
      id,
    };

    await redis.hset(alias, linkData);
  } catch (e) {
    // do something with the error
  }
};

const retrieveLinkFromRedisCache = async (
  alias: string,
): Promise<Link | null> => {
  try {
    const retrievedLink = (await redis.hgetall(alias)) as Link;
    return retrievedLink;
  } catch (e) {
    // do something with the error
    return null;
  }
};

const deleteLinkFromRedisCache = async (alias: string) => {
  try {
    await redis.del(alias);
  } catch (e) {
    // do something with the error
  }
};

export {
  addLinkToRedisCache,
  deleteLinkFromRedisCache,
  retrieveLinkFromRedisCache,
};

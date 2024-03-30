"use server";

import { Prisma } from "@prisma/client";
import { Redis } from "@upstash/redis";

import { env } from "@/env.mjs";

const redis = new Redis({
  url: env.UPSTASH_URL,
  token: env.UPSTASH_TOKEN,
});

export const retrieveLinkFromCache = async (alias: string) => {
  try {
    const retrievedLink = (await redis.hgetall(
      alias,
    )) as Prisma.LinkGetPayload<{}>;
    return retrievedLink;
  } catch (error) {
    return null;
  }
};

export const addLinkToCache = async (link: Prisma.LinkGetPayload<{}>) => {
  try {
    await redis.hset(link.alias, link);
  } catch (error) {
    return null;
  }
};

export const deleteLinkFromCache = async (alias: string) => {
  try {
    await redis.del(alias);
  } catch (error) {
    return null;
  }
};

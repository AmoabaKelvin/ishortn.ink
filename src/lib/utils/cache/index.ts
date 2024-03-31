"use server";

import { Prisma } from "@prisma/client";
import Redis from "ioredis";

import { env } from "@/env.mjs";

const redis = new Redis(env.REDIS_URL);

export const retrieveLinkFromCache = async (alias: string) => {
  try {
    const retrievedLink = await redis.hgetall(alias);
    return convertToPrismaLink(retrievedLink);
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

const convertToPrismaLink = (link: Record<string, string>) => {
  return {
    id: Number(link.id),
    url: link.url,
    alias: link.alias,
    userId: link.userId || null,
    createdAt: new Date(link.createdAt),
    disableLinkAfterClicks: link.disableLinkAfterClicks
      ? Number(link.disableLinkAfterClicks)
      : null,
    disableLinkAfterDate: link.disableLinkAfterDate
      ? new Date(link.disableLinkAfterDate)
      : null,
    disabled: link.disabled === "true",
    publicStats: link.publicStats === "true",
  };
};

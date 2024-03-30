import { Prisma } from "@prisma/client";
import { customAlphabet } from "nanoid";

import prisma from "@/db";

import { addLinkToCache, retrieveLinkFromCache } from "../cache";

const checkForAliasCollision = async (alias: string) => {
  const existingLink = await prisma.link.findFirst({
    where: {
      alias,
    },
  });

  return !!existingLink;
};

export const generateShortLink = async () => {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const nanoid = customAlphabet(alphabet, 7);

  const shortLink = nanoid();

  while (true) {
    if (await checkForAliasCollision(shortLink)) {
      return nanoid();
    }

    return shortLink;
  }
};

export const hasLinkExceededSpecifiedClicks = async (
  retrievedLink: Prisma.LinkGetPayload<{}>,
) => {
  if (retrievedLink.disableLinkAfterClicks) {
    const linkVisits = await prisma.linkVisit.findMany({
      where: {
        linkId: retrievedLink.id,
      },
    });

    return linkVisits.length >= retrievedLink.disableLinkAfterClicks;
  }

  return false;
};

export const hasLinkExceededSpecifiedDate = async (
  retrievedLink: Prisma.LinkGetPayload<{}>,
): Promise<boolean> => {
  if (retrievedLink.disableLinkAfterDate) {
    const currentDate = new Date();
    const linkDate = new Date(retrievedLink.disableLinkAfterDate);
    return currentDate >= linkDate;
  }

  return false;
};

export const retrieveLinkFromCacheOrDatabase = async (alias: string) => {
  const link = await retrieveLinkFromCache(alias);

  if (link?.url) {
    return link;
  }

  const retrievedLink = await prisma.link.findFirst({
    where: {
      alias,
    },
  });

  if (retrievedLink) {
    await addLinkToCache(retrievedLink);
    return retrievedLink;
  }

  return retrievedLink;
};

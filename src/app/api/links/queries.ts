import { Link } from "@/config/schemas/link";
import { generateShortUrl } from "../utils/links";

import { auth } from "@clerk/nextjs";

import prisma from "@/db";

export const checkIfAliasExists = async (alias: string) => {
  const link = await prisma.link.findUnique({
    where: {
      alias,
    },
  });
  if (link) return true;
  return false;
};

export const insertLink = async (
  url: string,
  alias: string
): Promise<string> => {
  const { userId } = auth();
  if (userId) {
    // Create a new link with the user
    const link = await prisma.link.create({
      data: {
        alias: alias || (await generateShortUrl(url)),
        url,
        userId,
      },
    });
    return link.alias;
  }
  const link = await prisma.link.create({
    data: {
      alias: alias || (await generateShortUrl(url)),
      url,
    },
  });
  return link.alias;
};

export const getLink = async (url: string): Promise<Link | null> => {
  const link = await prisma.link.findFirst({
    where: {
      url,
    },
  });
  if (link) return link;
  return null;
};

export const retrieveShortenedLink = async (
  alias: string
): Promise<string | null> => {
  const link = await prisma.link.findUnique({
    where: {
      alias,
    },
  });
  if (link) return link.url;
  return null;
};

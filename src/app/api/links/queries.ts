import { generateShortUrl } from "../utils/links";
import { Link } from "@/config/schemas/link";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const checkIfAliasExists = async (alias: string) => {
  const link = await prisma.shortenedUrl.findUnique({
    where: {
      alias,
    },
  });
  if (link) return true;
  return false;
};

export const insertLink = async (
  url: string,
  alias: string,
): Promise<string> => {
  const link = await prisma.shortenedUrl.create({
    data: {
      alias: alias || (await generateShortUrl(url)),
      url,
    },
  });
  return link.alias;
};

export const getLink = async (url: string): Promise<Link | null> => {
  const link = await prisma.shortenedUrl.findFirst({
    where: {
      url,
    },
  });
  if (link) return link;
  return null;
};

export const retrieveShortenedLink = async (
  alias: string,
): Promise<string | null> => {
  const link = await prisma.shortenedUrl.findUnique({
    where: {
      alias,
    },
  });
  if (link) return link.url;
  return null;
};

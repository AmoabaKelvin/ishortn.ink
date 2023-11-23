"use server";

import { Prisma } from "@prisma/client";
import { auth } from "@clerk/nextjs";

import prisma from "@/db";
import { generateShortUrl } from "@/app/api/utils/links";

export const createLink = async (link: Prisma.LinkCreateInput) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  const existingLink = await prisma.link.findUnique({
    where: {
      alias: link.alias,
    },
  });

  if (existingLink) {
    return {
      error: "Alias already exists, please enter another one",
    };
  }

  const createdLink = prisma.link.create({
    data: {
      ...link,
      alias: link.alias || (await generateShortUrl(link.url)),
      User: {
        connect: {
          id: userId,
        },
      },
    },
  });
  return createdLink;
};

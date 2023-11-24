"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@clerk/nextjs";
import { Prisma } from "@prisma/client";

import { generateShortUrl } from "@/app/api/utils/links";
import prisma from "@/db";

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
  revalidatePath("/dashboard");
  return createdLink;
};

export const quickLinkShorten = async (url: string) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  const createdLink = prisma.link.create({
    data: {
      url,
      alias: await generateShortUrl(url),
      User: {
        connect: {
          id: userId,
        },
      },
    },
  });
  revalidatePath("/dashboard");
  return createdLink;
};

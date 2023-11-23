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

  console.log("Link: ", link);

  try {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          error: "Alias already exists",
        };
      }
    }
  }
};

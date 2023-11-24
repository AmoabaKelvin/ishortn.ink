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

export const deleteLink = async (id: number) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  // Check if the link exists and belongs to the user
  const link = await prisma.link.findUnique({
    where: {
      id,
    },
  });

  if (!link) {
    return {
      error: "Link not found",
    };
  }

  if (link.userId !== userId) {
    return {
      error: "You are not authorized to delete this link",
    };
  }

  const deletedLink = prisma.link.delete({
    where: {
      id,
    },
  });
  revalidatePath("/dashboard");
  return deletedLink;
};

export const updateLink = async (link: Prisma.LinkUpdateInput, id: number) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  // Check if the link exists and belongs to the user
  const existingLink = await prisma.link.findUnique({
    where: {
      id: id,
    },
  });

  if (!existingLink) {
    return {
      error: "Link not found",
    };
  }

  if (existingLink.userId !== userId) {
    return {
      error: "You are not authorized to update this link",
    };
  }

  const updatedLink = prisma.link.update({
    where: {
      id: id,
    },
    data: {
      ...link,
    },
  });
  revalidatePath("/dashboard");
  return updatedLink;
};

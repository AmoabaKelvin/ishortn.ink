"use server";

import { auth } from "@clerk/nextjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import prisma from "@/db";
import { errorMessages } from "@/lib/constants";
import { addLinkToCache, deleteLinkFromCache } from "@/lib/utils/cache";
import { generateShortLink } from "@/lib/utils/links";
import { validateUrl } from "@/lib/utils/links/validation";

const authenticateAndGetUserId = () => {
  const { userId } = auth();
  if (!userId) {
    throw new Error("Authentication failed");
  }
  return userId;
};

const handleError = (linkCreator: string, userId: number) => {
  if (linkCreator !== userId.toString()) {
    throw new Error("You are not authorized to delete this link");
  }
};

export const createLink = async (link: Prisma.LinkCreateInput) => {
  const userId = authenticateAndGetUserId();

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

  const isLinkSafe = await validateUrl(link.url);

  if (!isLinkSafe) {
    return {
      error: errorMessages.UNSAFE,
    };
  }

  const createdLink = prisma.link.create({
    data: {
      ...link,
      alias: link.alias || (await generateShortLink()),
      User: {
        connect: {
          id: userId,
        },
      },
    },
  });

  // write-through cache pattern
  // ensures that the cache is always up to date
  await addLinkToCache(await createdLink);

  revalidatePath("/dashboard");
  return createdLink;
};

export const quickLinkShorten = async (url: string) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  const isLinkSafe = await validateUrl(url);

  if (!isLinkSafe) {
    return {
      error: errorMessages.UNSAFE,
    };
  }

  const createdLink = prisma.link.create({
    data: {
      url,
      alias: await generateShortLink(),
      User: {
        connect: {
          id: userId,
        },
      },
    },
  });
  revalidatePath("/dashboard");

  await addLinkToCache(await createdLink);

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
      error: errorMessages.NOT_FOUND,
    };
  }

  if (link.userId !== userId) {
    return {
      error: "You are not authorized to delete this link",
    };
  }

  // Delete all the clicks associated with the link
  await prisma.linkVisit.deleteMany({
    where: {
      linkId: id,
    },
  });

  const deletedLink = prisma.link.delete({
    where: {
      id,
    },
  });
  revalidatePath("/dashboard");

  await deleteLinkFromCache(link.alias);

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
      error: errorMessages.NOT_FOUND,
    };
  }

  if (existingLink.userId !== userId) {
    return {
      error: errorMessages.UNAUTHORIZED,
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

  // delete the old link from the cache and add the new one
  await deleteLinkFromCache(existingLink.alias);
  await addLinkToCache(await updatedLink);
  return updatedLink;
};

export const disableLink = async (id: number) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  const link = await prisma.link.findUnique({
    where: {
      id,
    },
  });

  if (!link) {
    return {
      error: errorMessages.NOT_FOUND,
    };
  }

  if (link.userId !== userId) {
    return {
      error: errorMessages.UNAUTHORIZED,
    };
  }

  const disabledLink = prisma.link.update({
    where: {
      id,
    },
    data: {
      disabled: true,
    },
  });
  revalidatePath("/dashboard");

  await deleteLinkFromCache(link.alias);
  await addLinkToCache(await disabledLink);

  return disabledLink;
};

export const enableLink = async (id: number) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  const link = await prisma.link.findUnique({
    where: {
      id,
    },
  });

  if (!link) {
    return {
      error: errorMessages.NOT_FOUND,
    };
  }

  if (link.userId !== userId) {
    return {
      error: errorMessages.UNAUTHORIZED,
    };
  }

  const enabledLink = prisma.link.update({
    where: {
      id,
    },
    data: {
      disabled: false,
    },
  });
  revalidatePath("/dashboard");

  await deleteLinkFromCache(link.alias);
  await addLinkToCache(await enabledLink);

  return enabledLink;
};

export const toggleLinkStats = async (id: number, toggle: boolean) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  const link = await prisma.link.findUnique({
    where: {
      id,
    },
  });

  if (!link) {
    return {
      error: errorMessages.NOT_FOUND,
    };
  }

  if (link.userId !== userId) {
    return {
      error: errorMessages.UNAUTHORIZED,
    };
  }

  const enabledLink = prisma.link.update({
    where: {
      id,
    },
    data: {
      publicStats: toggle,
    },
  });
  revalidatePath("/dashboard");
  return enabledLink;
};

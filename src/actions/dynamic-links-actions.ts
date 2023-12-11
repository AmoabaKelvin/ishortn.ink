"use server";

import prisma from "@/db";
import { generateShortLinkForProject } from "@/lib/utils";
import { auth } from "@clerk/nextjs";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

type DynamicLinkCreateInput = Omit<Prisma.DynamicLinkCreateInput, "user">;

export const createDynamicLink = async (
  link: DynamicLinkCreateInput,
  projectID?: number,
) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  const createdLink = prisma.dynamicLink.upsert({
    where: {
      id: projectID || 0,
    },
    update: {
      ...link,
    },
    create: {
      ...link,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
  revalidatePath("/dashboard/dynamic");
  return createdLink;
};

type DynamicLinkChildCreateInput = Omit<
  Prisma.DynamicLinkChildLinkCreateInput,
  "user" | "dynamicLink"
>;

export const createDynamicLinkChildLink = async (
  link: DynamicLinkChildCreateInput,
  selectedDynamicLinkProjectID: number,
  linkID?: number,
) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  if (!link.shortLink) {
    const existingLink = await prisma.dynamicLinkChildLink.findFirst({
      where: {
        link: link.link,
        dynamicLinkId: selectedDynamicLinkProjectID,
      },
    });

    // return the link and don't create a new one
    if (existingLink) {
      return { ...existingLink, alreadyExists: true };
    }

    link.shortLink = await generateShortLinkForProject(
      link.link,
      selectedDynamicLinkProjectID,
    );
  }

  const createdLink = prisma.dynamicLinkChildLink.upsert({
    where: {
      id: linkID || 0,
    },
    update: {
      ...link,
      dynamicLink: {
        connect: {
          id: selectedDynamicLinkProjectID,
        },
      },
    },
    create: {
      ...link,
      dynamicLink: {
        connect: {
          id: selectedDynamicLinkProjectID,
        },
      },
    },
  });

  revalidatePath("/dashboard/links/dynamic");
  return createdLink;
};

export const deleteDynamicLinkChildLink = async (id: number) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  // Check if the link exists and belongs to the user
  const link = await prisma.dynamicLinkChildLink.findUnique({
    where: {
      id,
    },
    include: {
      dynamicLink: true,
    },
  });

  if (!link) {
    return {
      error: "Link not found",
    };
  }

  if (link.dynamicLink.userId !== userId) {
    return {
      error: "You are not authorized to delete this link",
    };
  }

  const deletedLink = prisma.dynamicLinkChildLink.delete({
    where: {
      id,
    },
  });
  revalidatePath("/dashboard/links/dynamic");
  return deletedLink;
};

export const deleteDynamicLinkProject = async (id: number) => {
  const { userId } = auth();

  if (!userId) {
    return;
  }

  const link = await prisma.dynamicLink.findUnique({
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

  // Delete all the clicks associated with the link
  await prisma.dynamicLinkChildLink.deleteMany({
    where: {
      dynamicLinkId: id,
    },
  });

  const deletedLink = prisma.dynamicLink.delete({
    where: {
      id,
    },
  });

  revalidatePath("/dashboard/links/dynamic");
  return deletedLink;
};

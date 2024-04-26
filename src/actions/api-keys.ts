"use server";

import { auth } from "@clerk/nextjs";
import { revalidatePath } from "next/cache";

import prisma from "@/db";
import { generateHashedToken, generateToken } from "@/lib/utils/tokens";

export const createAPIKey = async () => {
  const { userId } = auth();
  const token = generateToken();

  await prisma.token.create({
    data: {
      token: await generateHashedToken(token),
      userId: userId!,
    },
  });

  return token;
};

export const revokeAPIKey = async (keyId: number) => {
  const key = await prisma.token.delete({
    where: {
      id: keyId,
    },
  });
  revalidatePath("/dashboard/settings");
  return key;
};

export const revalidatePathForDashboard = () => {
  revalidatePath("/dashboard/settings");
};
